/**
 * Biblioteca de Validação e Normalização de Telefones Brasileiros
 * 
 * Regras ANATEL:
 * - Celulares: 11 dígitos (DDD 2 dígitos + 9 + 8 dígitos)
 * - O primeiro dígito após o DDD deve ser 9 (celular)
 * - DDDs válidos do Brasil: 11-99 (com exceções)
 * 
 * Formato padrão de saída: (XX) 9 XXXX-XXXX
 */

// Lista de DDDs válidos do Brasil (ANATEL)
const VALID_DDDS = new Set([
  // São Paulo
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  // Rio de Janeiro e Espírito Santo
  '21', '22', '24', '27', '28',
  // Minas Gerais
  '31', '32', '33', '34', '35', '37', '38',
  // Paraná e Santa Catarina
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  // Rio Grande do Sul
  '51', '53', '54', '55',
  // Centro-Oeste (DF, GO, TO, MT, MS)
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  // Nordeste
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  // Norte
  '91', '92', '93', '94', '95', '96', '97', '98', '99'
]);

// Padrões de números inválidos (repetições)
const INVALID_PATTERNS = [
  /^(\d)\1{10}$/,  // Todos os dígitos iguais: 11111111111, 99999999999
  /^12345678901$/,
  /^01234567890$/,
  /^98765432109$/,
  /^00000000000$/
];

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;      // Apenas dígitos (11 dígitos)
  formatted: string | null;       // Formato (XX) 9 XXXX-XXXX
  original: string;
  errorCode: PhoneErrorCode | null;
  errorMessage: string | null;
}

export type PhoneErrorCode = 
  | 'EMPTY'
  | 'INVALID_CHARACTERS'
  | 'WRONG_LENGTH'
  | 'INVALID_DDD'
  | 'NOT_MOBILE'
  | 'REPEATED_DIGITS'
  | 'INVALID_FORMAT';

const ERROR_MESSAGES: Record<PhoneErrorCode, string> = {
  EMPTY: 'Número de telefone vazio',
  INVALID_CHARACTERS: 'Número contém caracteres inválidos',
  WRONG_LENGTH: 'Quantidade incorreta de dígitos (esperado: 11)',
  INVALID_DDD: 'DDD inválido',
  NOT_MOBILE: 'Número não é celular (deve iniciar com 9)',
  REPEATED_DIGITS: 'Número com dígitos repetidos inválidos',
  INVALID_FORMAT: 'Formato de número inválido'
};

/**
 * Remove todos os caracteres não-numéricos e normaliza DDI
 */
function extractDigits(phone: string): string {
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');
  
  // Remove DDI brasileiro se presente
  // Casos: +55, 0055, 55 (quando tem mais de 11 dígitos)
  if (digits.startsWith('0055')) {
    digits = digits.substring(4);
  } else if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }
  
  // Remove zero inicial de operadora (0XX) 
  if (digits.startsWith('0') && digits.length === 12) {
    digits = digits.substring(1);
  }
  
  return digits;
}

/**
 * Adiciona o 9º dígito se ausente (números antigos de 10 dígitos)
 */
function addNinthDigit(digits: string): string {
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2);
    const number = digits.substring(2);
    // Adiciona o 9 após o DDD
    return `${ddd}9${number}`;
  }
  return digits;
}

/**
 * Valida se o DDD é válido no Brasil
 */
function isValidDDD(ddd: string): boolean {
  return VALID_DDDS.has(ddd);
}

/**
 * Valida se é um número de celular (inicia com 9 após o DDD)
 */
function isMobileNumber(digits: string): boolean {
  if (digits.length !== 11) return false;
  // O 3º dígito (posição 2, após os 2 do DDD) deve ser 9
  return digits[2] === '9';
}

/**
 * Verifica padrões inválidos (repetições)
 */
function hasInvalidPattern(digits: string): boolean {
  return INVALID_PATTERNS.some(pattern => pattern.test(digits));
}

/**
 * Formata número para o padrão (XX) 9 XXXX-XXXX
 */
export function formatPhoneBR(digits: string): string | null {
  if (digits.length !== 11) return null;
  
  const ddd = digits.substring(0, 2);
  const firstDigit = digits.substring(2, 3);
  const firstPart = digits.substring(3, 7);
  const secondPart = digits.substring(7, 11);
  
  return `(${ddd}) ${firstDigit} ${firstPart}-${secondPart}`;
}

/**
 * Valida e normaliza um número de telefone brasileiro
 * 
 * @param phone - Número em qualquer formato
 * @returns Resultado da validação com número normalizado e formatado
 */
export function validateAndNormalizePhone(phone: string | null | undefined): PhoneValidationResult {
  const original = phone || '';
  
  // Validação: vazio
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'EMPTY',
      errorMessage: ERROR_MESSAGES.EMPTY
    };
  }
  
  // Extrair apenas dígitos
  let digits = extractDigits(phone);
  
  // Adicionar 9º dígito se necessário (compatibilidade com números antigos)
  digits = addNinthDigit(digits);
  
  // Validação: quantidade de dígitos
  if (digits.length !== 11) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'WRONG_LENGTH',
      errorMessage: `${ERROR_MESSAGES.WRONG_LENGTH} (encontrado: ${digits.length})`
    };
  }
  
  const ddd = digits.substring(0, 2);
  
  // Validação: DDD válido
  if (!isValidDDD(ddd)) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'INVALID_DDD',
      errorMessage: `${ERROR_MESSAGES.INVALID_DDD}: ${ddd}`
    };
  }
  
  // Validação: é celular (começa com 9)
  if (!isMobileNumber(digits)) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'NOT_MOBILE',
      errorMessage: ERROR_MESSAGES.NOT_MOBILE
    };
  }
  
  // Validação: padrões inválidos
  if (hasInvalidPattern(digits)) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'REPEATED_DIGITS',
      errorMessage: ERROR_MESSAGES.REPEATED_DIGITS
    };
  }
  
  // Número válido!
  return {
    isValid: true,
    normalized: digits,
    formatted: formatPhoneBR(digits),
    original,
    errorCode: null,
    errorMessage: null
  };
}

/**
 * Normaliza telefone para apenas dígitos (para comparações)
 * Retorna null se inválido
 */
export function normalizePhoneForComparison(phone: string | null | undefined): string | null {
  const result = validateAndNormalizePhone(phone);
  return result.isValid ? result.normalized : null;
}

/**
 * Formata telefone para exibição (XX) 9 XXXX-XXXX
 * Retorna o original se inválido
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const result = validateAndNormalizePhone(phone);
  return result.formatted || phone;
}

/**
 * Verifica se dois telefones são equivalentes
 * Considera variações do 9º dígito para compatibilidade
 */
export function phonesAreEqual(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  if (!phone1 || !phone2) return false;
  
  const norm1 = normalizePhoneForComparison(phone1);
  const norm2 = normalizePhoneForComparison(phone2);
  
  if (!norm1 || !norm2) return false;
  
  return norm1 === norm2;
}

/**
 * Gera variações de um telefone para busca (com e sem 9º dígito)
 * Útil para buscar números antigos no banco
 */
export function generatePhoneVariations(phone: string | null | undefined): string[] {
  if (!phone) return [];
  
  let digits = extractDigits(phone);
  
  // Garante que temos o formato normalizado
  digits = addNinthDigit(digits);
  
  if (digits.length !== 11) return [digits];
  
  const variations: string[] = [digits];
  
  // Adiciona variação sem o 9º dígito (para buscar números antigos)
  if (digits[2] === '9') {
    const withoutNine = digits.substring(0, 2) + digits.substring(3);
    variations.push(withoutNine);
  }
  
  return variations;
}

/**
 * Normaliza telefone para formato de armazenamento (localPhone)
 * Formato: DDD + 8 dígitos (sem o nono dígito)
 * Exemplo: "1199887766"
 * 
 * Baseado na lógica n8n para padronização:
 * - Remove DDI 55 se presente
 * - Remove o 9º dígito de celulares
 * - Retorna DDD + 8 dígitos
 */
export interface LocalPhoneResult {
  valido: boolean;
  razao?: string;
  telefoneEntrada: string;
  ddd?: string;
  numero8?: string;
  localPhone?: string;      // DDD + 8 dígitos (ex: "1199887766")
  intlPhone?: string;       // 55 + DDD + 8 dígitos (ex: "551199887766")
  tinhaDDI55?: boolean;
  removeuNonoDigito?: boolean;
}

export function normalizeToLocalPhone(phone: string | null | undefined): LocalPhoneResult {
  const raw = phone ?? '';
  const digits = String(raw).replace(/\D/g, '');
  
  // Nada para processar
  if (!digits) {
    return {
      valido: false,
      razao: 'Telefone vazio ou inválido',
      telefoneEntrada: digits
    };
  }
  
  // Se veio com mais de 11 dígitos, precisa iniciar com 55 (Brasil)
  if (digits.length > 11 && !digits.startsWith('55')) {
    return {
      valido: false,
      razao: 'Para números com mais de 11 dígitos, o prefixo deve iniciar com 55',
      telefoneEntrada: digits
    };
  }
  
  // Remove DDI 55 se existir
  let hasCountry = false;
  let local = digits;
  if (local.startsWith('55') && local.length > 11) {
    hasCountry = true;
    local = local.slice(2);
  }
  
  // Agora esperamos 10 (fixo/celular sem nono) ou 11 (celular com nono) dígitos locais
  if (local.length !== 10 && local.length !== 11) {
    return {
      valido: false,
      razao: 'Quantidade de dígitos locais inválida (esperado 10 ou 11 após DDI)',
      telefoneEntrada: digits
    };
  }
  
  // DDD (2) + número (8 ou 9)
  const ddd = local.slice(0, 2);
  let numeroRestante = local.slice(2);
  
  // Valida DDD minimamente (não inicia com 0 e dois dígitos)
  if (!/^[1-9]\d$/.test(ddd)) {
    return {
      valido: false,
      razao: 'DDD inválido',
      telefoneEntrada: digits
    };
  }
  
  let removedNinth = false;
  // Se tem 11 dígitos locais, precisa começar com 9 (nono dígito dos celulares)
  if (local.length === 11) {
    if (numeroRestante[0] !== '9') {
      return {
        valido: false,
        razao: 'Para 11 dígitos locais, o nono dígito deve ser 9 (celular)',
        telefoneEntrada: digits
      };
    }
    // Removemos o 9 para padronizar em 8 dígitos
    numeroRestante = numeroRestante.slice(1);
    removedNinth = true;
  }
  
  // Neste ponto, numeroRestante **deve** ter 8 dígitos
  if (!/^\d{8}$/.test(numeroRestante)) {
    return {
      valido: false,
      razao: 'Número local inválido; esperado exatamente 8 dígitos após o DDD',
      telefoneEntrada: digits
    };
  }
  
  // Monta saídas
  const numero8 = numeroRestante;
  const localPhone = `${ddd}${numero8}`;
  const intlPhone = `55${localPhone}`;
  
  return {
    valido: true,
    ddd,
    numero8,
    localPhone,       // ex.: "1199887766"
    intlPhone,        // ex.: "551199887766"
    tinhaDDI55: hasCountry,
    removeuNonoDigito: removedNinth,
    telefoneEntrada: digits
  };
}

/**
 * Validação PERMISSIVA para importação de planilhas
 * Aceita qualquer número com 10-11 dígitos, fixo ou celular
 * Não exige 9º dígito, não valida se é celular
 */
export interface PermissivePhoneResult {
  isValid: boolean;
  normalized: string | null;      // Apenas dígitos (10-11 dígitos)
  formatted: string | null;       // Formato com máscara
  original: string;
  errorCode: PhoneErrorCode | null;
  errorMessage: string | null;
}

export function validatePhonePermissive(phone: string | null | undefined): PermissivePhoneResult {
  const original = phone || '';
  
  // Validação: vazio
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'EMPTY',
      errorMessage: ERROR_MESSAGES.EMPTY
    };
  }
  
  // Extrair apenas dígitos
  let digits = extractDigits(phone);
  
  // Aceitar números de 10 a 11 dígitos
  if (digits.length < 10 || digits.length > 11) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'WRONG_LENGTH',
      errorMessage: `Quantidade incorreta de dígitos (esperado: 10-11, encontrado: ${digits.length})`
    };
  }
  
  const ddd = digits.substring(0, 2);
  
  // Validação: DDD válido
  if (!isValidDDD(ddd)) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'INVALID_DDD',
      errorMessage: `${ERROR_MESSAGES.INVALID_DDD}: ${ddd}`
    };
  }
  
  // Validação: padrões inválidos (repetições)
  if (hasInvalidPattern(digits)) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      original,
      errorCode: 'REPEATED_DIGITS',
      errorMessage: ERROR_MESSAGES.REPEATED_DIGITS
    };
  }
  
  // Formatar de acordo com o tamanho
  let formatted: string;
  if (digits.length === 11) {
    // Celular: (XX) 9 XXXX-XXXX
    formatted = `(${ddd}) ${digits[2]} ${digits.substring(3, 7)}-${digits.substring(7, 11)}`;
  } else {
    // Fixo: (XX) XXXX-XXXX
    formatted = `(${ddd}) ${digits.substring(2, 6)}-${digits.substring(6, 10)}`;
  }
  
  // Número válido!
  return {
    isValid: true,
    normalized: digits,
    formatted,
    original,
    errorCode: null,
    errorMessage: null
  };
}

/**
 * Validação em lote PERMISSIVA para importação
 */
export function validatePhoneBatchPermissive(phones: string[]): PhoneBatchValidationResult {
  const result: PhoneBatchValidationResult = {
    valid: [],
    invalid: [],
    duplicates: [],
    summary: { total: phones.length, valid: 0, invalid: 0, duplicates: 0 }
  };
  
  const seenPhones = new Map<string, number>(); // normalized -> first index
  
  phones.forEach((phone, index) => {
    const validation = validatePhonePermissive(phone);
    
    if (!validation.isValid) {
      result.invalid.push({
        original: phone,
        errorCode: validation.errorCode!,
        errorMessage: validation.errorMessage!,
        index
      });
      result.summary.invalid++;
      return;
    }
    
    // Checar duplicatas
    const normalized = validation.normalized!;
    if (seenPhones.has(normalized)) {
      result.duplicates.push({
        original: phone,
        normalized,
        index,
        duplicateOf: seenPhones.get(normalized)!
      });
      result.summary.duplicates++;
      return;
    }
    
    seenPhones.set(normalized, index);
    result.valid.push({
      original: phone,
      normalized,
      formatted: validation.formatted!,
      index
    });
    result.summary.valid++;
  });
  
  return result;
}

/**
 * Interface para relatório de importação em lote
 */
export interface PhoneBatchValidationResult {
  valid: Array<{
    original: string;
    normalized: string;
    formatted: string;
    index: number;
  }>;
  invalid: Array<{
    original: string;
    errorCode: PhoneErrorCode;
    errorMessage: string;
    index: number;
  }>;
  duplicates: Array<{
    original: string;
    normalized: string;
    index: number;
    duplicateOf: number;
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
}

/**
 * Valida um lote de telefones e retorna relatório completo
 * Inclui detecção de duplicatas dentro do lote
 */
export function validatePhoneBatch(phones: string[]): PhoneBatchValidationResult {
  const result: PhoneBatchValidationResult = {
    valid: [],
    invalid: [],
    duplicates: [],
    summary: { total: phones.length, valid: 0, invalid: 0, duplicates: 0 }
  };
  
  const seenPhones = new Map<string, number>(); // normalized -> first index
  
  phones.forEach((phone, index) => {
    const validation = validateAndNormalizePhone(phone);
    
    if (!validation.isValid) {
      result.invalid.push({
        original: phone,
        errorCode: validation.errorCode!,
        errorMessage: validation.errorMessage!,
        index
      });
      result.summary.invalid++;
      return;
    }
    
    // Checar duplicatas
    const normalized = validation.normalized!;
    if (seenPhones.has(normalized)) {
      result.duplicates.push({
        original: phone,
        normalized,
        index,
        duplicateOf: seenPhones.get(normalized)!
      });
      result.summary.duplicates++;
      return;
    }
    
    seenPhones.set(normalized, index);
    result.valid.push({
      original: phone,
      normalized,
      formatted: validation.formatted!,
      index
    });
    result.summary.valid++;
  });
  
  return result;
}

/**
 * Extrai apenas dígitos de um telefone (uso interno)
 */
export function extractPhoneDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  return extractDigits(phone);
}
