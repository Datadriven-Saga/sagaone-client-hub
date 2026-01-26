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
  descricao?: string;
  categoria?: string;
  marca?: string;
  dealerid?: string;
  dealer_id?: string;
  telefone_pri?: string;
  telefone_pri_whatsapp?: string;
  uf?: string;
  cidade?: string;
  endereco?: string;
  data_inicio?: string;
  data_fim?: string;
  evt_status?: string;
  status?: string;
}

interface SyncResult {
  total_webhook: number;
  total_local_eventos_pri_voz: number;
  total_local_prospeccoes: number;
  eventos_pri_voz_criados: string[];
  eventos_pri_voz_atualizados: string[];
  prospeccoes_criados: string[];
  prospeccoes_atualizados: string[];
  erros: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pri_telefone, empresa_id, dealer_id, dry_run = false } = await req.json();

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
      total_local_eventos_pri_voz: 0,
      total_local_prospeccoes: 0,
      eventos_pri_voz_criados: [],
      eventos_pri_voz_atualizados: [],
      prospeccoes_criados: [],
      prospeccoes_atualizados: [],
      erros: [],
    };

    // ===============================================
    // ETAPA 1: Buscar eventos do webhook externo
    // ===============================================
    console.log(`📡 Buscando eventos do webhook: ${WEBHOOK_URL}`);
    const telefoneFormatado = String(pri_telefone).replace(/\D/g, '');

    let eventosWebhook: WebhookEvento[] = [];
    
    try {
      // Tentar POST primeiro com telefone_pri e dealer_id
      const postBody: Record<string, string> = {
        telefone_pri: telefoneFormatado,
      };
      
      if (dealer_id) {
        postBody.dealer_id = dealer_id;
      }

      let webhookResponse = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...webhookAuthHeaders },
        body: JSON.stringify(postBody),
      });

      let webhookText = await webhookResponse.text();

      // Se POST falhar com 404, tentar GET
      if (webhookResponse.status === 404 && webhookText.toLowerCase().includes('not registered for post')) {
        console.log('⚠️ Webhook exige GET, tentando novamente...');
        const url = new URL(WEBHOOK_URL);
        url.searchParams.set('telefone_pri', telefoneFormatado);
        if (dealer_id) {
          url.searchParams.set('dealer_id', dealer_id);
        }

        webhookResponse = await fetch(url.toString(), {
          method: 'GET',
          headers: webhookAuthHeaders,
        });
        webhookText = await webhookResponse.text();
      }

      console.log(`📥 Resposta do webhook (status ${webhookResponse.status}):`, webhookText.substring(0, 500));

      if (webhookResponse.ok) {
        try {
          const parsed = JSON.parse(webhookText);
          eventosWebhook = Array.isArray(parsed) ? parsed : (parsed?.eventos || parsed?.data || []);
        } catch (e) {
          console.error('❌ Erro ao parsear resposta do webhook:', e);
        }
      }
    } catch (webhookError) {
      console.error('⚠️ Erro ao consultar webhook:', webhookError);
      result.erros.push(`Erro ao consultar webhook: ${webhookError}`);
    }

    console.log(`📋 Eventos encontrados no webhook: ${eventosWebhook.length}`);
    result.total_webhook = eventosWebhook.length;

    // ===============================================
    // ETAPA 2: Buscar eventos locais existentes
    // ===============================================
    const { data: eventosLocaisPriVoz, error: localPriVozError } = await supabase
      .from('eventos_pri_voz')
      .select('*')
      .eq('empresa_id', empresa_id);

    if (localPriVozError) {
      console.error('❌ Erro ao buscar eventos_pri_voz:', localPriVozError);
      result.erros.push(`Erro ao buscar eventos_pri_voz: ${localPriVozError.message}`);
    }

    result.total_local_eventos_pri_voz = eventosLocaisPriVoz?.length || 0;
    console.log(`📂 Eventos em eventos_pri_voz: ${result.total_local_eventos_pri_voz}`);

    // Mapear eventos_pri_voz por id_evento
    const eventosLocalMap = new Map<number, any>();
    (eventosLocaisPriVoz || []).forEach(evt => {
      if (evt.id_evento) {
        eventosLocalMap.set(Number(evt.id_evento), evt);
      }
    });

    // Buscar prospecções locais de Ligação
    const { data: prospeccoesLocais, error: prospeccoesError } = await supabase
      .from('prospeccoes')
      .select('id, titulo, canal, event_id_pri, data_inicio, data_fim, empresa_id, ativo')
      .eq('empresa_id', empresa_id)
      .ilike('canal', '%Liga%');

    if (prospeccoesError) {
      console.error('❌ Erro ao buscar prospeccoes:', prospeccoesError);
      result.erros.push(`Erro ao buscar prospeccoes: ${prospeccoesError.message}`);
    }

    result.total_local_prospeccoes = prospeccoesLocais?.length || 0;
    console.log(`📂 Prospecções de Ligação: ${result.total_local_prospeccoes}`);

    // Mapear prospecções por event_id_pri
    const prospeccoesMap = new Map<string, any>();
    (prospeccoesLocais || []).forEach(evt => {
      if (evt.event_id_pri) {
        prospeccoesMap.set(evt.event_id_pri, evt);
      }
    });

    // ===============================================
    // ETAPA 3: Sincronizar eventos do webhook → eventos_pri_voz
    // ===============================================
    console.log('🔄 Sincronizando eventos do webhook → eventos_pri_voz...');
    
    for (const webhookEvt of eventosWebhook) {
      const eventIdNum = Number(webhookEvt.id_evento || webhookEvt.event_id || webhookEvt.id);
      
      if (!eventIdNum || isNaN(eventIdNum)) {
        console.warn('⚠️ Evento sem id_evento válido:', webhookEvt);
        continue;
      }

      const eventIdStr = String(eventIdNum);
      const isAtivo = String(webhookEvt.evt_status || webhookEvt.status || 'ativo').toLowerCase() !== 'inativo';
      
      const eventoData = {
        id_evento: eventIdNum,
        nome: webhookEvt.nome || webhookEvt.titulo || `Evento Ligação ${eventIdNum}`,
        descricao: webhookEvt.descricao || null,
        categoria: webhookEvt.categoria || 'evento',
        marca: webhookEvt.marca || null,
        dealerid: webhookEvt.dealerid || webhookEvt.dealer_id || dealer_id || null,
        telefone_pri: webhookEvt.telefone_pri || telefoneFormatado,
        telefone_pri_whatsapp: webhookEvt.telefone_pri_whatsapp || null,
        uf: webhookEvt.uf || null,
        cidade: webhookEvt.cidade || null,
        endereco: webhookEvt.endereco || null,
        data_inicio: webhookEvt.data_inicio || null,
        data_fim: webhookEvt.data_fim || null,
        evt_status: isAtivo ? 'ativo' : 'inativo',
        empresa_id: empresa_id,
        atualizado_em: new Date().toISOString(),
      };

      const existente = eventosLocalMap.get(eventIdNum);

      if (!existente) {
        // Criar novo registro em eventos_pri_voz
        console.log(`➕ Criar em eventos_pri_voz: ${eventIdNum} - ${eventoData.nome}`);
        
        if (!dry_run) {
          const { error: insertError } = await supabase
            .from('eventos_pri_voz')
            .insert({
              ...eventoData,
              criado_em: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`❌ Erro ao inserir eventos_pri_voz ${eventIdNum}:`, insertError);
            result.erros.push(`Inserir eventos_pri_voz ${eventIdNum}: ${insertError.message}`);
          } else {
            result.eventos_pri_voz_criados.push(`${eventIdNum} (${eventoData.nome})`);
            // Adicionar ao mapa local para sincronização de prospeccoes
            eventosLocalMap.set(eventIdNum, { ...eventoData, id_evento: eventIdNum });
          }
        } else {
          result.eventos_pri_voz_criados.push(`${eventIdNum} (${eventoData.nome}) (dry_run)`);
        }
      } else {
        // Atualizar registro existente se mudou algo relevante
        const needsUpdate = 
          existente.nome !== eventoData.nome ||
          existente.evt_status !== eventoData.evt_status ||
          existente.telefone_pri !== eventoData.telefone_pri;

        if (needsUpdate) {
          console.log(`🔄 Atualizar em eventos_pri_voz: ${eventIdNum}`);
          
          if (!dry_run) {
            const { error: updateError } = await supabase
              .from('eventos_pri_voz')
              .update(eventoData)
              .eq('id_evento', eventIdNum)
              .eq('empresa_id', empresa_id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar eventos_pri_voz ${eventIdNum}:`, updateError);
              result.erros.push(`Atualizar eventos_pri_voz ${eventIdNum}: ${updateError.message}`);
            } else {
              result.eventos_pri_voz_atualizados.push(`${eventIdNum} (${eventoData.nome})`);
            }
          } else {
            result.eventos_pri_voz_atualizados.push(`${eventIdNum} (${eventoData.nome}) (dry_run)`);
          }
        }
      }
    }

    // ===============================================
    // ETAPA 4: Sincronizar eventos_pri_voz → prospeccoes
    // ===============================================
    console.log('🔄 Sincronizando eventos_pri_voz → prospeccoes...');

    // Recarregar eventos_pri_voz após inserções
    const { data: eventosAtualizados } = await supabase
      .from('eventos_pri_voz')
      .select('*')
      .eq('empresa_id', empresa_id);

    for (const evtPri of (eventosAtualizados || [])) {
      const eventIdStr = String(evtPri.id_evento);
      const isAtivo = String(evtPri.evt_status || 'ativo').toLowerCase() !== 'inativo';

      const existenteProsp = prospeccoesMap.get(eventIdStr);

      if (!existenteProsp) {
        // Criar nova prospecção
        console.log(`➕ Criar em prospeccoes: ${eventIdStr} - ${evtPri.nome}`);
        
        if (!dry_run) {
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
              descricao: evtPri.descricao || null,
            })
            .select('id, titulo')
            .single();

          if (createError) {
            console.error(`❌ Erro ao criar prospeccao ${eventIdStr}:`, createError);
            result.erros.push(`Criar prospeccao ${eventIdStr}: ${createError.message}`);
          } else {
            result.prospeccoes_criados.push(`${eventIdStr} → ${novoEvento?.id} (${evtPri.nome})`);
            prospeccoesMap.set(eventIdStr, novoEvento);
          }
        } else {
          result.prospeccoes_criados.push(`${eventIdStr} (${evtPri.nome}) (dry_run)`);
        }
      } else {
        // Verificar se precisa atualizar status ativo
        if (existenteProsp.ativo !== isAtivo) {
          console.log(`🔄 Atualizar status prospeccao ${existenteProsp.id}: ativo=${isAtivo}`);
          
          if (!dry_run) {
            const { error: updateError } = await supabase
              .from('prospeccoes')
              .update({ ativo: isAtivo })
              .eq('id', existenteProsp.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar prospeccao:`, updateError);
              result.erros.push(`Atualizar prospeccao ${existenteProsp.id}: ${updateError.message}`);
            } else {
              result.prospeccoes_atualizados.push(`${eventIdStr} (${evtPri.nome})`);
            }
          } else {
            result.prospeccoes_atualizados.push(`${eventIdStr} (${evtPri.nome}) (dry_run)`);
          }
        }
      }
    }

    console.log(`✅ Sincronização concluída:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        result,
        summary: {
          eventos_webhook: result.total_webhook,
          eventos_pri_voz_criados: result.eventos_pri_voz_criados.length,
          eventos_pri_voz_atualizados: result.eventos_pri_voz_atualizados.length,
          prospeccoes_criados: result.prospeccoes_criados.length,
          prospeccoes_atualizados: result.prospeccoes_atualizados.length,
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
