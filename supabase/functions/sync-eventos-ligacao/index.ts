import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos';

interface WebhookEvento {
  id_evento?: string;
  event_id?: string;
  id?: string;
  nome?: string;
  titulo?: string;
  data_inicio?: string;
  data_fim?: string;
  status?: string;
}

interface SyncResult {
  total_webhook: number;
  total_local: number;
  criados: string[];
  deletados: string[];
  mantidos: string[];
  erros: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pri_telefone, empresa_id, dry_run = false } = await req.json();

    if (!pri_telefone) {
      return new Response(
        JSON.stringify({ error: 'pri_telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: 'empresa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Iniciando sincronização para pri_telefone: ${pri_telefone}, empresa: ${empresa_id}`);

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar eventos do webhook externo
    console.log(`📡 Buscando eventos do webhook: ${WEBHOOK_URL}`);
    
    const telefoneFormatado = String(pri_telefone).replace(/\D/g, '');
    
    // Tentar POST primeiro, depois GET se necessário
    let webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agente_id: telefoneFormatado,
        telefone: telefoneFormatado,
      }),
    });

    let webhookText = await webhookResponse.text();

    // Se POST falhar com 404, tentar GET
    if (webhookResponse.status === 404 && webhookText.toLowerCase().includes('not registered for post')) {
      console.log('⚠️ Webhook exige GET, tentando novamente...');
      const url = new URL(WEBHOOK_URL);
      url.searchParams.set('agente_id', telefoneFormatado);
      url.searchParams.set('telefone', telefoneFormatado);
      
      webhookResponse = await fetch(url.toString(), { method: 'GET' });
      webhookText = await webhookResponse.text();
    }

    console.log(`📥 Resposta do webhook (status ${webhookResponse.status}):`, webhookText.substring(0, 500));

    let eventosWebhook: WebhookEvento[] = [];
    try {
      const parsed = JSON.parse(webhookText);
      eventosWebhook = Array.isArray(parsed) ? parsed : (parsed?.eventos || parsed?.data || []);
    } catch (e) {
      console.error('❌ Erro ao parsear resposta do webhook:', e);
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do webhook', raw: webhookText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Eventos encontrados no webhook: ${eventosWebhook.length}`);

    // Extrair IDs únicos do webhook (normalizar diferentes campos de ID)
    const webhookEventIds = new Map<string, WebhookEvento>();
    eventosWebhook.forEach(evt => {
      const eventId = String(evt.id_evento || evt.event_id || evt.id || '').trim();
      if (eventId) {
        webhookEventIds.set(eventId, evt);
      }
    });

    console.log(`🔑 IDs únicos no webhook: ${webhookEventIds.size}`);

    // 2. Buscar eventos locais de Ligação para esta empresa
    const { data: eventosLocais, error: localError } = await supabase
      .from('prospeccoes')
      .select('id, titulo, canal, event_id_pri, data_inicio, data_fim, empresa_id')
      .eq('empresa_id', empresa_id)
      .ilike('canal', '%Liga%');

    if (localError) {
      console.error('❌ Erro ao buscar eventos locais:', localError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar eventos locais', details: localError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📂 Eventos locais de Ligação encontrados: ${eventosLocais?.length || 0}`);

    // 3. Comparar e sincronizar
    const result: SyncResult = {
      total_webhook: webhookEventIds.size,
      total_local: eventosLocais?.length || 0,
      criados: [],
      deletados: [],
      mantidos: [],
      erros: [],
    };

    // Mapear eventos locais por event_id_pri
    const locaisMap = new Map<string, typeof eventosLocais[0]>();
    (eventosLocais || []).forEach(evt => {
      if (evt.event_id_pri) {
        locaisMap.set(evt.event_id_pri, evt);
      }
    });

    // 3a. Eventos no webhook que NÃO existem localmente → CRIAR
    for (const [eventId, webhookEvt] of webhookEventIds) {
      if (!locaisMap.has(eventId)) {
        console.log(`➕ Criar evento local: ${eventId} - ${webhookEvt.nome || webhookEvt.titulo || 'Sem nome'}`);
        
        if (!dry_run) {
          const { data: novoEvento, error: createError } = await supabase
            .from('prospeccoes')
            .insert({
              titulo: webhookEvt.nome || webhookEvt.titulo || `Evento Ligação ${eventId}`,
              canal: 'Ligação',
              empresa_id: empresa_id,
              event_id_pri: eventId,
              data_inicio: webhookEvt.data_inicio || null,
              data_fim: webhookEvt.data_fim || null,
            })
            .select('id, titulo')
            .single();

          if (createError) {
            console.error(`❌ Erro ao criar evento ${eventId}:`, createError);
            result.erros.push(`Criar ${eventId}: ${createError.message}`);
          } else {
            result.criados.push(`${eventId} → ${novoEvento?.id}`);
          }
        } else {
          result.criados.push(`${eventId} (dry_run)`);
        }
      } else {
        result.mantidos.push(eventId);
      }
    }

    // 3b. Eventos locais que NÃO existem no webhook → DELETAR
    for (const [eventIdPri, localEvt] of locaisMap) {
      if (!webhookEventIds.has(eventIdPri)) {
        console.log(`🗑️ Deletar evento local: ${localEvt.id} - ${localEvt.titulo} (event_id_pri: ${eventIdPri})`);
        
        if (!dry_run) {
          // Primeiro deletar registros relacionados em eventos_prospeccao
          const { error: deleteEventosError } = await supabase
            .from('eventos_prospeccao')
            .delete()
            .eq('prospeccao_id', localEvt.id);

          if (deleteEventosError) {
            console.error(`❌ Erro ao deletar eventos_prospeccao para ${localEvt.id}:`, deleteEventosError);
          }

          // Deletar o evento de prospecção
          const { error: deleteError } = await supabase
            .from('prospeccoes')
            .delete()
            .eq('id', localEvt.id);

          if (deleteError) {
            console.error(`❌ Erro ao deletar evento ${localEvt.id}:`, deleteError);
            result.erros.push(`Deletar ${localEvt.id}: ${deleteError.message}`);
          } else {
            result.deletados.push(`${localEvt.id} (${localEvt.titulo})`);
          }
        } else {
          result.deletados.push(`${localEvt.id} (${localEvt.titulo}) (dry_run)`);
        }
      }
    }

    // 3c. Eventos locais SEM event_id_pri → Avisar (são órfãos)
    const orfaos = (eventosLocais || []).filter(evt => !evt.event_id_pri);
    if (orfaos.length > 0) {
      console.log(`⚠️ Eventos locais sem event_id_pri (órfãos): ${orfaos.length}`);
      orfaos.forEach(evt => {
        result.erros.push(`Órfão sem event_id_pri: ${evt.id} - ${evt.titulo}`);
      });
    }

    console.log(`✅ Sincronização concluída:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        result,
        summary: {
          criados: result.criados.length,
          deletados: result.deletados.length,
          mantidos: result.mantidos.length,
          erros: result.erros.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno na sincronização' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
