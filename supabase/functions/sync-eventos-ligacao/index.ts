import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos';

const SAGA_ONE = Deno.env.get('SAGA_ONE') ?? '';
const webhookAuthHeaders: Record<string, string> = SAGA_ONE
  ? { 'saga_one_supabase': SAGA_ONE }
  : {};

interface WebhookEvento {
  id_evento?: string | number;
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
  total_eventos_pri_voz: number;
  criados: string[];
  deletados: string[];
  mantidos: string[];
  sincronizados_de_eventos_pri: string[];
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
    console.log(`🔐 SAGA_ONE configurado: ${Boolean(SAGA_ONE)} (len: ${SAGA_ONE.length})`);

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: SyncResult = {
      total_webhook: 0,
      total_local: 0,
      total_eventos_pri_voz: 0,
      criados: [],
      deletados: [],
      mantidos: [],
      sincronizados_de_eventos_pri: [],
      erros: [],
    };

    // 1. Buscar eventos já existentes em eventos_pri_voz para esta empresa
    console.log(`📂 Buscando eventos de eventos_pri_voz para empresa: ${empresa_id}`);
    const { data: eventosPriVoz, error: priVozError } = await supabase
      .from('eventos_pri_voz')
      .select('*')
      .eq('empresa_id', empresa_id);

    if (priVozError) {
      console.error('❌ Erro ao buscar eventos_pri_voz:', priVozError);
    } else {
      console.log(`📋 Eventos em eventos_pri_voz: ${eventosPriVoz?.length || 0}`);
      result.total_eventos_pri_voz = eventosPriVoz?.length || 0;
    }

    // 2. Buscar eventos locais de Ligação na tabela prospeccoes
    const { data: eventosLocais, error: localError } = await supabase
      .from('prospeccoes')
      .select('id, titulo, canal, event_id_pri, data_inicio, data_fim, empresa_id, ativo')
      .eq('empresa_id', empresa_id)
      .ilike('canal', '%Liga%');

    if (localError) {
      console.error('❌ Erro ao buscar eventos locais:', localError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar eventos locais', details: localError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📂 Eventos locais de Ligação em prospeccoes: ${eventosLocais?.length || 0}`);
    result.total_local = eventosLocais?.length || 0;

    // Mapear eventos locais por event_id_pri
    const locaisMap = new Map<string, typeof eventosLocais[0]>();
    (eventosLocais || []).forEach(evt => {
      if (evt.event_id_pri) {
        locaisMap.set(evt.event_id_pri, evt);
      }
    });

    // 3. NOVA LÓGICA: Sincronizar eventos de eventos_pri_voz → prospeccoes
    // Isso garante que eventos de Ligação apareçam na lista principal
    if (eventosPriVoz && eventosPriVoz.length > 0) {
      for (const evtPri of eventosPriVoz) {
        const eventIdStr = String(evtPri.id_evento);
        
        // Verificar se já existe em prospeccoes
        if (!locaisMap.has(eventIdStr)) {
          console.log(`➕ Criar evento em prospeccoes de eventos_pri_voz: ${eventIdStr} - ${evtPri.nome}`);
          
          if (!dry_run) {
            const isAtivo = evtPri.evt_status?.toLowerCase() !== 'inativo';
            
            const { data: novoEvento, error: createError } = await supabase
              .from('prospeccoes')
              .insert({
                titulo: evtPri.nome || `Evento Ligação ${eventIdStr}`,
                canal: 'Ligação',
                empresa_id: empresa_id,
                event_id_pri: eventIdStr,
                data_inicio: evtPri.data_inicio || null,
                data_fim: evtPri.data_fim || null,
                ativo: isAtivo,
              })
              .select('id, titulo')
              .single();

            if (createError) {
              console.error(`❌ Erro ao criar evento de eventos_pri_voz ${eventIdStr}:`, createError);
              result.erros.push(`Criar de eventos_pri_voz ${eventIdStr}: ${createError.message}`);
            } else {
              result.sincronizados_de_eventos_pri.push(`${eventIdStr} → ${novoEvento?.id} (${evtPri.nome})`);
              // Adicionar ao mapa para evitar duplicações
              locaisMap.set(eventIdStr, { ...novoEvento, event_id_pri: eventIdStr } as any);
            }
          } else {
            result.sincronizados_de_eventos_pri.push(`${eventIdStr} (${evtPri.nome}) (dry_run)`);
          }
        } else {
          // Evento já existe, verificar se precisa atualizar status ativo
          const existente = locaisMap.get(eventIdStr)!;
          const isAtivo = evtPri.evt_status?.toLowerCase() !== 'inativo';
          
          if (existente.ativo !== isAtivo) {
            console.log(`🔄 Atualizar status de ${existente.id}: ativo=${isAtivo}`);
            
            if (!dry_run) {
              const { error: updateError } = await supabase
                .from('prospeccoes')
                .update({ ativo: isAtivo })
                .eq('id', existente.id);
              
              if (updateError) {
                console.error(`❌ Erro ao atualizar status:`, updateError);
              }
            }
          }
          
          result.mantidos.push(`${eventIdStr} (já existe em prospeccoes)`);
        }
      }
    }

    // 4. Tentar buscar eventos do webhook externo também (fallback)
    console.log(`📡 Buscando eventos do webhook: ${WEBHOOK_URL}`);
    const telefoneFormatado = String(pri_telefone).replace(/\D/g, '');

    try {
      let webhookResponse = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...webhookAuthHeaders },
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

        webhookResponse = await fetch(url.toString(), {
          method: 'GET',
          headers: webhookAuthHeaders,
        });
        webhookText = await webhookResponse.text();
      }

      console.log(`📥 Resposta do webhook (status ${webhookResponse.status}):`, webhookText.substring(0, 500));

      if (webhookResponse.ok) {
        let eventosWebhook: WebhookEvento[] = [];
        try {
          const parsed = JSON.parse(webhookText);
          eventosWebhook = Array.isArray(parsed) ? parsed : (parsed?.eventos || parsed?.data || []);
        } catch (e) {
          console.error('❌ Erro ao parsear resposta do webhook:', e);
        }

        console.log(`📋 Eventos encontrados no webhook: ${eventosWebhook.length}`);
        result.total_webhook = eventosWebhook.length;

        // Extrair IDs únicos do webhook
        const webhookEventIds = new Map<string, WebhookEvento>();
        eventosWebhook.forEach(evt => {
          const eventId = String(evt.id_evento || evt.event_id || evt.id || '').trim();
          if (eventId) {
            webhookEventIds.set(eventId, evt);
          }
        });

        // Criar eventos do webhook que não existem localmente
        for (const [eventId, webhookEvt] of webhookEventIds) {
          if (!locaisMap.has(eventId)) {
            console.log(`➕ Criar evento local do webhook: ${eventId} - ${webhookEvt.nome || webhookEvt.titulo || 'Sem nome'}`);
            
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
                locaisMap.set(eventId, novoEvento as any);
              }
            } else {
              result.criados.push(`${eventId} (dry_run)`);
            }
          }
        }
      }
    } catch (webhookError) {
      console.error('⚠️ Erro ao consultar webhook (continuando com eventos_pri_voz):', webhookError);
    }

    // 5. Alertar sobre eventos órfãos (em prospeccoes mas não em eventos_pri_voz)
    const eventIdsPriVoz = new Set((eventosPriVoz || []).map(e => String(e.id_evento)));
    const orfaos = (eventosLocais || []).filter(evt => 
      evt.event_id_pri && !eventIdsPriVoz.has(evt.event_id_pri)
    );
    
    if (orfaos.length > 0) {
      console.log(`⚠️ Eventos em prospeccoes sem correspondência em eventos_pri_voz: ${orfaos.length}`);
      orfaos.forEach(evt => {
        result.erros.push(`Órfão: ${evt.id} - ${evt.titulo} (event_id_pri: ${evt.event_id_pri})`);
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
          sincronizados_de_eventos_pri: result.sincronizados_de_eventos_pri.length,
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
