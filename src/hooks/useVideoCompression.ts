import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const MAX_VIDEO_SIZE_MB = 12;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

interface CompressionProgress {
  stage: 'loading' | 'compressing' | 'done' | 'error';
  progress: number; // 0-100
  message: string;
}

interface UseVideoCompressionReturn {
  compressVideo: (file: File) => Promise<File | null>;
  isCompressing: boolean;
  compressionProgress: CompressionProgress | null;
  cancelCompression: () => void;
}

export const useVideoCompression = (): UseVideoCompressionReturn => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const cancelledRef = useRef(false);

  const loadFFmpeg = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current) {
      return ffmpegRef.current;
    }

    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    ffmpeg.on('progress', ({ progress }) => {
      if (!cancelledRef.current) {
        const percent = Math.round(progress * 100);
        setCompressionProgress({
          stage: 'compressing',
          progress: percent,
          message: `Comprimindo vídeo: ${percent}%`
        });
      }
    });

    setCompressionProgress({
      stage: 'loading',
      progress: 0,
      message: 'Carregando compressor de vídeo...'
    });

    // Check if SharedArrayBuffer is available (required for multi-threaded FFmpeg)
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    console.log('[FFmpeg] SharedArrayBuffer available:', hasSharedArrayBuffer);

    // Add timeout to prevent infinite loading
    const loadWithTimeout = async (loadFn: () => Promise<void>, timeoutMs: number = 30000): Promise<void> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('FFmpeg load timeout'));
        }, timeoutMs);

        loadFn()
          .then(() => {
            clearTimeout(timeout);
            resolve();
          })
          .catch((err) => {
            clearTimeout(timeout);
            reject(err);
          });
      });
    };

    // Try single-threaded UMD version first (most compatible)
    const umdURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    try {
      console.log('[FFmpeg] Loading single-threaded UMD version...');
      await loadWithTimeout(async () => {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${umdURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${umdURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }, 45000);
      console.log('[FFmpeg] Loaded successfully (UMD)');
    } catch (umdError) {
      console.error('[FFmpeg] UMD load failed:', umdError);
      
      // Try ESM version as fallback
      const esmURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      try {
        console.log('[FFmpeg] Trying ESM version...');
        await loadWithTimeout(async () => {
          await ffmpeg.load({
            coreURL: await toBlobURL(`${esmURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${esmURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
        }, 45000);
        console.log('[FFmpeg] Loaded successfully (ESM)');
      } catch (esmError) {
        console.error('[FFmpeg] ESM load also failed:', esmError);
        throw new Error('Não foi possível carregar o compressor de vídeo. Tente usar um vídeo menor que 12MB.');
      }
    }

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const calculateTargetBitrate = (
    originalSize: number,
    durationSeconds: number
  ): number => {
    // Target 10MB to have some margin (10MB * 8 bits = 80Mbit)
    const targetSizeBits = 10 * 1024 * 1024 * 8;
    // Bitrate in kbps
    const targetBitrate = Math.floor(targetSizeBits / durationSeconds / 1000);
    // Minimum 300kbps, maximum 2000kbps
    return Math.max(300, Math.min(targetBitrate, 2000));
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Não foi possível ler a duração do vídeo'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const compressVideo = useCallback(async (file: File): Promise<File | null> => {
    // If file is already under the limit, return it as-is
    if (file.size <= MAX_VIDEO_SIZE_BYTES) {
      console.log('Video is already under size limit, no compression needed');
      return file;
    }

    cancelledRef.current = false;
    setIsCompressing(true);

    try {
      const ffmpeg = await loadFFmpeg();

      if (cancelledRef.current) {
        setIsCompressing(false);
        return null;
      }

      // Get video duration to calculate appropriate bitrate
      const duration = await getVideoDuration(file);
      const targetBitrate = calculateTargetBitrate(file.size, duration);

      console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Duration: ${duration.toFixed(2)}s`);
      console.log(`Target bitrate: ${targetBitrate}kbps`);

      setCompressionProgress({
        stage: 'compressing',
        progress: 0,
        message: 'Iniciando compressão...'
      });

      // Write input file to FFmpeg virtual filesystem
      const inputFileName = 'input.mp4';
      const outputFileName = 'output.mp4';

      await ffmpeg.writeFile(inputFileName, await fetchFile(file));

      if (cancelledRef.current) {
        setIsCompressing(false);
        return null;
      }

      // Compress video with calculated bitrate
      // Otimizações para velocidade (WASM é lento): preset ultrafast + downscale 720p
      await ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '32',
        '-vf', 'scale=-2:720',
        '-b:v', `${targetBitrate}k`,
        '-maxrate', `${Math.floor(targetBitrate * 1.2)}k`,
        '-bufsize', `${targetBitrate * 2}k`,
        '-c:a', 'aac',
        '-b:a', '96k',
        '-movflags', '+faststart',
        '-y',
        outputFileName
      ]);

      if (cancelledRef.current) {
        setIsCompressing(false);
        return null;
      }

      // Read compressed file
      const data = await ffmpeg.readFile(outputFileName);
      // Convert to ArrayBuffer properly for Blob
      let blobData: BlobPart;
      if (typeof data === 'string') {
        blobData = data;
      } else {
        // Copy the Uint8Array to avoid SharedArrayBuffer issues
        blobData = new Uint8Array(data).slice().buffer;
      }
      const compressedBlob = new Blob([blobData], { type: 'video/mp4' });

      console.log(`Compressed size: ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`);

      // If still too large, try again with more aggressive settings
      if (compressedBlob.size > MAX_VIDEO_SIZE_BYTES) {
        console.log('First compression not enough, trying with lower quality...');

        await ffmpeg.exec([
          '-i', inputFileName,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '36',
          '-b:v', `${Math.floor(targetBitrate * 0.5)}k`,
          '-maxrate', `${Math.floor(targetBitrate * 0.7)}k`,
          '-bufsize', `${Math.floor(targetBitrate)}k`,
          '-vf', 'scale=-2:480',
          '-c:a', 'aac',
          '-b:a', '64k',
          '-movflags', '+faststart',
          '-y',
          outputFileName
        ]);

        const data2 = await ffmpeg.readFile(outputFileName);
        let blobData2: BlobPart;
        if (typeof data2 === 'string') {
          blobData2 = data2;
        } else {
          blobData2 = new Uint8Array(data2).slice().buffer;
        }
        const compressedBlob2 = new Blob([blobData2], { type: 'video/mp4' });

        console.log(`Second compression size: ${(compressedBlob2.size / 1024 / 1024).toFixed(2)}MB`);

        if (compressedBlob2.size > MAX_VIDEO_SIZE_BYTES) {
          setCompressionProgress({
            stage: 'error',
            progress: 0,
            message: 'Não foi possível comprimir o vídeo para menos de 12MB. Tente um vídeo mais curto.'
          });
          setIsCompressing(false);
          return null;
        }

        setCompressionProgress({
          stage: 'done',
          progress: 100,
          message: 'Compressão concluída!'
        });

        // Clean up
        await ffmpeg.deleteFile(inputFileName);
        await ffmpeg.deleteFile(outputFileName);

        setIsCompressing(false);

        // Create a new File object with original name but .mp4 extension
        const originalName = file.name.replace(/\.[^/.]+$/, '');
        return new File([compressedBlob2], `${originalName}_compressed.mp4`, {
          type: 'video/mp4'
        });
      }

      setCompressionProgress({
        stage: 'done',
        progress: 100,
        message: 'Compressão concluída!'
      });

      // Clean up
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);

      setIsCompressing(false);

      // Create a new File object
      const originalName = file.name.replace(/\.[^/.]+$/, '');
      return new File([compressedBlob], `${originalName}_compressed.mp4`, { 
        type: 'video/mp4' 
      });

    } catch (error) {
      console.error('Video compression error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao comprimir vídeo. Tente novamente.';
      setCompressionProgress({
        stage: 'error',
        progress: 0,
        message: errorMessage
      });
      setIsCompressing(false);
      return null;
    }
  }, []);

  const cancelCompression = useCallback(() => {
    cancelledRef.current = true;
    setIsCompressing(false);
    setCompressionProgress(null);
  }, []);

  return {
    compressVideo,
    isCompressing,
    compressionProgress,
    cancelCompression
  };
};

export { MAX_VIDEO_SIZE_MB, MAX_VIDEO_SIZE_BYTES };
