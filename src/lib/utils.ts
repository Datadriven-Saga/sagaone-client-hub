import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { 
  validateAndNormalizePhone, 
  formatPhoneForDisplay, 
  extractPhoneDigits 
} from "./phoneUtils"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza um número de telefone removendo parênteses, traços e espaços.
 * Mantém apenas dígitos e opcionalmente o símbolo +.
 * @param phone - Número de telefone a ser normalizado
 * @returns Telefone normalizado ou null se vazio
 * @deprecated Use extractPhoneDigits from phoneUtils para normalização simples
 *             ou validateAndNormalizePhone para validação completa
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove tudo exceto dígitos e +
  return phone.replace(/[^\d+]/g, '') || null;
}

/**
 * Formata um número de telefone brasileiro no padrão (XX) 9 XXXX-XXXX
 * Usa a biblioteca centralizada de validação de telefones
 * @param phone - Número de telefone (pode estar com ou sem formatação)
 * @returns Telefone formatado ou o valor original se não for possível formatar
 */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Usa a função centralizada que valida e formata
  const result = validateAndNormalizePhone(phone);
  
  if (result.isValid && result.formatted) {
    return result.formatted;
  }
  
  // Fallback: tenta formatação básica para números legados/fixos
  const digits = extractPhoneDigits(phone);
  
  if (digits.length === 0) return null;
  
  // Se tiver 10 dígitos (fixo): (XX) XXXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  // Se tiver 11 dígitos (celular): (XX) 9 XXXX-XXXX
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  
  // Retorna o número original se não se encaixar em nenhum padrão
  return phone;
}

/**
 * Formata um nome para ter a primeira letra de cada palavra em maiúscula
 * @param name - Nome a ser formatado
 * @returns Nome formatado ou o valor original se vazio
 */
export function formatName(name: string | null | undefined): string | null {
  if (!name) return null;
  
  const trimmed = name.trim();
  if (!trimmed) return null;
  
  // Palavras que devem permanecer em minúsculo (exceto se forem a primeira palavra)
  const lowerCaseWords = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'por', 'com'];
  
  return trimmed
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      if (lowerCaseWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
