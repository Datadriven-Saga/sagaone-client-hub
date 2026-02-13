/**
 * Utilitário para disparar email CRM via Edge Function send-crm-event-email.
 * 
 * Características:
 * - Retorna resultado para exibição de alertas na UI
 * - Retry automático (1 tentativa extra)
 * - Timeout de 5 segundos
 * - Proteção contra envios duplicados
 * - Logs estruturados
 */

const EDGE_FUNCTION_URL = 'https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/send-crm-event-email';

// Set para evitar envios duplicados na mesma sessão
const enviadosSet = new Set<string>();

export interface CrmEmailResult {
  success: boolean;
  enviados: number;
  erros: number;
  total_destinatarios: number;
  message?: string;
  error?: string;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callEdgeFunction(eventId: string): Promise<CrmEmailResult> {
  console.log(`📧 [send-crm-event-email] Iniciando envio para event_id: ${eventId}`);

  const response = await fetchWithTimeout(
    EDGE_FUNCTION_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId }),
    },
    30000
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  console.log(`✅ [send-crm-event-email] Sucesso para event_id: ${eventId}`, data);
  return {
    success: true,
    enviados: data.enviados ?? 0,
    erros: data.erros ?? 0,
    total_destinatarios: data.total_destinatarios ?? 0,
    message: data.message,
  };
}

/**
 * Dispara email CRM com retry e retorna o resultado para exibição de alertas.
 */
export async function sendCrmEventEmail(eventId: string): Promise<CrmEmailResult> {
  // Validação
  if (!eventId || eventId === 'undefined') {
    console.error('❌ [send-crm-event-email] event_id inválido:', eventId);
    return { success: false, enviados: 0, erros: 0, total_destinatarios: 0, error: 'event_id inválido' };
  }

  // Proteção contra duplicados
  if (enviadosSet.has(eventId)) {
    console.warn(`⚠️ [send-crm-event-email] Envio duplicado bloqueado para event_id: ${eventId}`);
    return { success: true, enviados: 0, erros: 0, total_destinatarios: 0, message: 'Envio já realizado' };
  }

  enviadosSet.add(eventId);

  try {
    return await callEdgeFunction(eventId);
  } catch (firstError: any) {
    console.warn(`⚠️ [send-crm-event-email] Primeira tentativa falhou: ${firstError.message}. Retentando...`);

    try {
      return await callEdgeFunction(eventId);
    } catch (retryError: any) {
      console.error(`❌ [send-crm-event-email] Retry também falhou para event_id ${eventId}:`, {
        erro: retryError.message,
        timestamp: new Date().toISOString(),
      });
      enviadosSet.delete(eventId);
      return { success: false, enviados: 0, erros: 0, total_destinatarios: 0, error: retryError.message };
    }
  }
}

/**
 * Função de diagnóstico para testar a Edge Function manualmente.
 * Pode ser chamada via console do browser: testEmailEdgeFunction('uuid-do-evento')
 */
export async function testEmailEdgeFunction(eventId: string): Promise<void> {
  console.log('🧪 [DIAGNÓSTICO] Testando send-crm-event-email...');
  console.log(`🧪 event_id: ${eventId}`);
  console.log(`🧪 URL: ${EDGE_FUNCTION_URL}`);

  if (!eventId) {
    console.error('🧪 ❌ event_id não fornecido. Uso: testEmailEdgeFunction("uuid-do-evento")');
    return;
  }

  try {
    const response = await fetchWithTimeout(
      EDGE_FUNCTION_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      },
      10000
    );

    const data = await response.json();
    console.log('🧪 Status:', response.status);
    console.log('🧪 Response:', JSON.stringify(data, null, 2));
    console.log(`🧪 ${response.ok ? '✅ SUCESSO' : '❌ FALHA'}`);
  } catch (err: any) {
    console.error('🧪 ❌ Erro na chamada:', err.message);
  }
}

// Expor para uso no console do browser
if (typeof window !== 'undefined') {
  (window as any).testEmailEdgeFunction = testEmailEdgeFunction;
}
