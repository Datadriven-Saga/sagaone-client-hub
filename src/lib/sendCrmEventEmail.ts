/**
 * Utilitário para disparar email CRM via Edge Function send-crm-event-email.
 * 
 * Características:
 * - Fire-and-forget (não bloqueia fluxo principal)
 * - Retry automático (1 tentativa extra)
 * - Timeout de 5 segundos
 * - Proteção contra envios duplicados
 * - Logs estruturados
 */

const EDGE_FUNCTION_URL = 'https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/send-crm-event-email';

// Set para evitar envios duplicados na mesma sessão
const enviados = new Set<string>();

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callEdgeFunction(eventId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log(`📧 [send-crm-event-email] Iniciando envio para event_id: ${eventId}`);

  const response = await fetchWithTimeout(
    EDGE_FUNCTION_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId }),
    },
    5000
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  console.log(`✅ [send-crm-event-email] Sucesso para event_id: ${eventId}`, data);
  return { success: true, data };
}

/**
 * Dispara email CRM de forma resiliente (fire-and-forget com retry).
 * Não lança exceções - apenas loga erros.
 */
export async function sendCrmEventEmail(eventId: string): Promise<void> {
  // Validação
  if (!eventId || eventId === 'undefined') {
    console.error('❌ [send-crm-event-email] event_id inválido:', eventId);
    return;
  }

  // Proteção contra duplicados
  if (enviados.has(eventId)) {
    console.warn(`⚠️ [send-crm-event-email] Envio duplicado bloqueado para event_id: ${eventId}`);
    return;
  }

  enviados.add(eventId);

  try {
    await callEdgeFunction(eventId);
  } catch (firstError: any) {
    console.warn(`⚠️ [send-crm-event-email] Primeira tentativa falhou: ${firstError.message}. Retentando...`);

    try {
      await callEdgeFunction(eventId);
    } catch (retryError: any) {
      console.error(`❌ [send-crm-event-email] Retry também falhou para event_id ${eventId}:`, {
        erro: retryError.message,
        timestamp: new Date().toISOString(),
      });
      // Remover do set para permitir nova tentativa manual
      enviados.delete(eventId);
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
