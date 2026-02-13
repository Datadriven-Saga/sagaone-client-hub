import { supabase } from "@/integrations/supabase/client";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface UploadOptions {
  bucket: string;
  folder: string;
  file: File | Blob;
  fileName?: string;
  maxSize?: number;
  allowedTypes?: string[];
}

interface UploadResult {
  url: string;
  path: string;
}

/**
 * Validates file type and size before upload
 */
export function validateImageFile(
  file: File | Blob,
  maxSize = MAX_FILE_SIZE,
  allowedTypes = ALLOWED_IMAGE_TYPES
): { valid: boolean; error?: string } {
  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `Arquivo muito grande. Máximo ${maxMB}MB.` };
  }

  if (file instanceof File && !allowedTypes.includes(file.type)) {
    return { valid: false, error: "Tipo de arquivo não suportado. Use JPG, PNG, GIF ou WebP." };
  }

  return { valid: true };
}

/**
 * Upload a file to Supabase Storage with validation
 */
export async function uploadToStorage({
  bucket,
  folder,
  file,
  fileName,
  maxSize = MAX_FILE_SIZE,
  allowedTypes = ALLOWED_IMAGE_TYPES,
}: UploadOptions): Promise<UploadResult> {
  // Validate
  const validation = validateImageFile(file, maxSize, allowedTypes);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Determine file extension
  let ext = "png";
  if (file instanceof File) {
    ext = file.name.split(".").pop()?.toLowerCase() || "png";
  } else if (file.type) {
    ext = file.type.split("/")[1] || "png";
  }

  const name = fileName || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = `${folder}/${name}.${ext}`;

  // Upload
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: file instanceof File ? file.type : `image/${ext}`,
      upsert: true,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Erro no upload: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
  };
}

/**
 * Upload a base64 data URL or remote URL image to Storage
 */
export async function uploadImageUrlToStorage(
  imageUrl: string,
  bucket: string,
  folder: string,
  fileName?: string
): Promise<UploadResult> {
  let blob: Blob;

  if (imageUrl.startsWith("data:")) {
    // Convert base64 data URL to blob
    const response = await fetch(imageUrl);
    blob = await response.blob();
  } else {
    // Fetch remote image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error("Não foi possível baixar a imagem.");
    }
    blob = await response.blob();
  }

  return uploadToStorage({
    bucket,
    folder,
    file: blob,
    fileName,
    allowedTypes: [...ALLOWED_IMAGE_TYPES, "application/octet-stream"],
  });
}

/**
 * Delete a file from storage by its full URL
 */
export async function deleteFromStorage(fileUrl: string, bucket: string): Promise<void> {
  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.indexOf(bucket);
    if (bucketIndex !== -1) {
      const filePath = pathParts.slice(bucketIndex + 1).join("/");
      await supabase.storage.from(bucket).remove([filePath]);
    }
  } catch (error) {
    console.error("Error deleting from storage:", error);
  }
}
