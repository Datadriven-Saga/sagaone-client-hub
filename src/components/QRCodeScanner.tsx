import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { CheckinData } from '@/hooks/useRecepcaoData';

interface QRCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (data: CheckinData) => void;
  validarEvento: (eventoId: string) => Promise<{ id: string; titulo: string } | null>;
  buscarContato: (telefone: string, eventoId: string) => Promise<any>;
}

// Formato simplificado do QR Code
interface SimplifiedQRData {
  telefone: string;
  evento_id: string;
}

// Formato antigo do QR Code (para compatibilidade)
interface LegacyQRData {
  qr_token: string;
  convidado_nome: string;
  convidado_telefone: string;
  quem_convidou: string;
  vendedor: string;
  evento_id?: string;
  evento_nome?: string;
}

export function QRCodeScanner({ 
  isOpen, 
  onClose, 
  onScanComplete,
  validarEvento,
  buscarContato 
}: QRCodeScannerProps) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ nome: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isInitializingRef = useRef(false);
  const { toast } = useToast();
  const { activeCompany } = useCompany();

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        // Ignorar erros ao parar
      }
      try {
        scannerRef.current.clear();
      } catch (err) {
        // Ignorar erros ao limpar
      }
      scannerRef.current = null;
    }
  }, []);

  const parseQRData = (decodedText: string): { telefone: string; evento_id: string; evento_nome?: string } | null => {
    // Primeiro tenta parsear como JSON
    try {
      const data = JSON.parse(decodedText);
      
      // Formato simplificado: { telefone, evento_id }
      if (data.telefone && data.evento_id) {
        return {
          telefone: data.telefone,
          evento_id: data.evento_id,
          evento_nome: data.evento_nome
        };
      }
      
      // Formato legado: { qr_token, convidado_telefone, evento_id, ... }
      if (data.convidado_telefone && data.evento_id) {
        return {
          telefone: data.convidado_telefone,
          evento_id: data.evento_id,
          evento_nome: data.evento_nome
        };
      }
      
      // Formato legado sem evento_id explícito
      if (data.convidado_telefone) {
        return {
          telefone: data.convidado_telefone,
          evento_id: '',
          evento_nome: data.evento_nome
        };
      }
    } catch {
      // Não é JSON, tentar formato texto
    }

    // Formato texto: "telefone: XXXXX\nevento-id: UUID" ou variações
    try {
      const text = decodedText.trim();
      
      // Regex para capturar telefone (aceita "telefone:", "Telefone:", espaços, etc.)
      const telefoneMatch = text.match(/telefone\s*:\s*(\+?\d[\d\s\-().]*\d)/i);
      
      // Regex para capturar evento_id (aceita "evento-id:", "evento_id:", "eventoid:", etc.)
      const eventoIdMatch = text.match(/evento[-_]?id\s*:\s*([a-f0-9-]{36})/i);
      
      if (telefoneMatch && eventoIdMatch) {
        // Limpa o telefone removendo caracteres não numéricos (exceto + no início)
        let telefone = telefoneMatch[1].replace(/[\s\-().]/g, '');
        if (telefone.startsWith('+')) {
          telefone = telefone.substring(1);
        }
        
        return {
          telefone: telefone,
          evento_id: eventoIdMatch[1],
          evento_nome: undefined
        };
      }
      
      // Formato alternativo: apenas telefone e UUID separados por linha
      const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        const phoneLine = lines.find(l => /telefone/i.test(l));
        const eventLine = lines.find(l => /evento/i.test(l));
        
        if (phoneLine && eventLine) {
          const phoneValue = phoneLine.split(':')[1]?.trim().replace(/[\s\-().]/g, '');
          const eventValue = eventLine.split(':')[1]?.trim();
          
          if (phoneValue && eventValue && /^[a-f0-9-]{36}$/i.test(eventValue)) {
            return {
              telefone: phoneValue,
              evento_id: eventValue,
              evento_nome: undefined
            };
          }
        }
      }
    } catch {
      // Falha no parse de texto
    }

    return null;
  };

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    if (status === 'processing' || status === 'success') return;
    
    setStatus('processing');
    await stopScanner();

    console.log('QR Code scanned:', decodedText);

    try {
      const qrData = parseQRData(decodedText);
      
      if (!qrData || !qrData.telefone) {
        throw new Error('QR Code inválido - formato não reconhecido');
      }

      // Validar evento se tiver evento_id
      let eventoValidado: { id: string; titulo: string } | null = null;
      if (qrData.evento_id) {
        eventoValidado = await validarEvento(qrData.evento_id);
        if (!eventoValidado) {
          throw new Error('Evento não encontrado ou não pertence a esta empresa');
        }
      }

      // Buscar contato pelo telefone no evento
      const contato = qrData.evento_id 
        ? await buscarContato(qrData.telefone, qrData.evento_id)
        : null;

      const checkinData: CheckinData = {
        telefone: qrData.telefone,
        evento_id: qrData.evento_id || '',
        evento_nome: eventoValidado?.titulo || qrData.evento_nome || 'Evento',
        contato: contato,
        isNewContact: !contato
      };

      setSuccessData({ 
        nome: contato?.nome || 'Novo Visitante' 
      });
      setStatus('success');

      // Notificar componente pai para abrir modal de confirmação
      setTimeout(() => {
        onScanComplete(checkinData);
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Error processing QR code:', err);
      setErrorMessage(err.message || 'QR Code inválido');
      setStatus('error');
      
      toast({
        title: 'Erro ao ler QR Code',
        description: err.message || 'Tente novamente ou registre manualmente.',
        variant: 'destructive',
      });
    }
  }, [status, stopScanner, activeCompany, toast, onScanComplete, onClose, validarEvento, buscarContato]);

  const startScanner = useCallback(async () => {
    if (isInitializingRef.current || scannerRef.current) return;
    
    isInitializingRef.current = true;
    setStatus('starting');
    setErrorMessage(null);

    try {
      // Aguardar mais tempo para garantir que o container esteja no DOM
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const container = document.getElementById('qr-reader-container');
      if (!container) {
        console.error('Container qr-reader-container não encontrado no DOM');
        throw new Error('Aguarde e tente novamente');
      }

      // Limpar qualquer conteúdo anterior do container
      container.innerHTML = '';

      const html5QrCode = new Html5Qrcode('qr-reader-container');
      scannerRef.current = html5QrCode;

      // Tentar iniciar com facingMode environment (câmera traseira) primeiro
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 200, height: 200 },
            aspectRatio: 1.0,
          },
          handleScanSuccess,
          () => {} // Ignorar erros normais de scan
        );
        setStatus('scanning');
        isInitializingRef.current = false;
        return;
      } catch (envErr) {
        console.log('Câmera traseira não disponível, tentando listar câmeras...', envErr);
      }

      // Fallback: listar câmeras disponíveis
      const cameras = await Html5Qrcode.getCameras();
      
      if (!cameras || cameras.length === 0) {
        throw new Error('Nenhuma câmera disponível');
      }

      // Preferir câmera traseira pelo label
      let cameraId = cameras[0].id;
      for (const camera of cameras) {
        const label = camera.label.toLowerCase();
        if (label.includes('back') || label.includes('rear') || label.includes('traseira') || label.includes('environment')) {
          cameraId = camera.id;
          break;
        }
      }
      // Se tem mais de uma câmera, a última geralmente é a traseira em mobile
      if (cameras.length > 1 && cameraId === cameras[0].id) {
        cameraId = cameras[cameras.length - 1].id;
      }

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        () => {} // Ignorar erros normais de scan
      );
      
      setStatus('scanning');
      isInitializingRef.current = false;
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      isInitializingRef.current = false;
      
      let msg = 'Não foi possível acessar a câmera.';
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission') || err.message?.includes('denied')) {
        msg = 'Permissão da câmera negada. Permita o acesso nas configurações do navegador.';
      } else if (err.name === 'NotFoundError' || err.message?.includes('Nenhuma')) {
        msg = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (err.name === 'NotReadableError' || err.message?.includes('Could not start')) {
        msg = 'Câmera em uso por outro aplicativo. Feche outros apps e tente novamente.';
      } else if (err.name === 'OverconstrainedError') {
        msg = 'Câmera não suporta as configurações solicitadas.';
      }
      
      setErrorMessage(msg);
      setStatus('error');
    }
  }, [handleScanSuccess]);

  useEffect(() => {
    if (isOpen && status === 'idle') {
      // Aguardar o próximo frame para garantir que o Dialog montou o container
      const timeoutId = setTimeout(() => {
        startScanner();
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, status, startScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
      isInitializingRef.current = false;
    };
  }, [stopScanner]);

  const handleClose = useCallback(() => {
    stopScanner();
    setStatus('idle');
    setErrorMessage(null);
    setSuccessData(null);
    isInitializingRef.current = false;
    onClose();
  }, [stopScanner, onClose]);

  const handleRetry = useCallback(() => {
    stopScanner();
    setStatus('idle');
    setErrorMessage(null);
    isInitializingRef.current = false;
    setTimeout(() => startScanner(), 200);
  }, [stopScanner, startScanner]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Camera className="w-5 h-5 text-primary" />
            Check-in via QR Code
          </DialogTitle>
          <DialogDescription className="text-sm">
            Aponte a câmera para o QR Code do convite
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center min-h-[280px] sm:min-h-[320px]">
          {/* Container do scanner SEMPRE presente para evitar erro de DOM */}
          <div 
            className={`w-full flex flex-col items-center ${status === 'success' || status === 'error' || status === 'processing' ? 'hidden' : ''}`}
          >
            <div className="relative w-full max-w-[280px] aspect-square rounded-xl overflow-hidden bg-black">
              <div 
                id="qr-reader-container" 
                className="w-full h-full"
              />
              {/* Overlay com cantos destacados */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[200px] h-[200px] relative">
                    {/* Cantos */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  </div>
                </div>
              </div>
              {/* Loading overlay */}
              {status === 'starting' && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-white animate-spin mb-2" />
                  <p className="text-xs text-white/80">Iniciando câmera...</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3 px-4">
              Mantenha o QR Code centralizado na área de leitura
            </p>
          </div>

          {status === 'success' && successData && (
            <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">
                QR Code lido!
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {successData.nome}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground mb-4 max-w-[250px]">
                {errorMessage}
              </p>
              <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Tentar novamente
              </Button>
            </div>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center p-8">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Processando...</p>
            </div>
          )}
        </div>

        <div className="flex justify-center pt-2">
          <Button 
            variant="ghost" 
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
