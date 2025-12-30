import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza um número de telefone removendo parênteses, traços e espaços.
 * Mantém apenas dígitos e opcionalmente o símbolo +.
 * @param phone - Número de telefone a ser normalizado
 * @returns Telefone normalizado ou null se vazio
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove tudo exceto dígitos e +
  return phone.replace(/[^\d+]/g, '') || null;
}
