import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 1000;
const MAX_RETRIES = 3;

const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  return digits;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Classifica retorno do webhook (Lambda/n8n) em categorias amigáveis.
// `duplicate` = anti-dup eterno da Lambda (mesmo número+template); NÃO é falha.
function classifyError(httpStatus: number, body: string): { categoria: string; mensagem: string } {
  const b = (body || '').toLowerCase();
  if (b.includes('disparo repetido')) return { categoria: 'duplicate', mensagem: 'Já disparado anteriormente' };
  if (b.includes('workflow not found') || b.includes('not active')) return { categoria: 'workflow_inactive', mensagem: 'Workflow inativo' };
  // Erros específicos da Lambda PRI/Maia
  if (b.includes('numero invalido') || b.includes('telefone do lead invalido') || b.includes('numero pri invalido')) {
    return { categoria: 'numero_invalido', mensagem: 'Número de telefone inválido' };
  }
  if (httpStatus === 404 && (b.includes('agente nao encontrado') || b.includes('instancia maia nao encontrada'))) {
    return { categoria: 'agente_nao_encontrado', mensagem: 'Agente/instância Maia não encontrada' };
  }
  if (httpStatus === 404 && b.includes('evento pri nao encontrado')) {
    return { categoria: 'evento_nao_encontrado', mensagem: 'Evento PRI não encontrado para o lead' };
  }
  if (httpStatus === 404 && b.includes('cadencia nao encontrada')) {
    return { categoria: 'cadencia_nao_encontrada', mensagem: 'Cadência não encontrada para o evento' };
  }
  if (httpStatus === 404 && b.includes('template nao encontrado')) {
    return { categoria: 'template_nao_encontrado', mensagem: 'Template não encontrado' };
  }
  if (httpStatus === 400 && (b.includes('payload bruto invalido') || b.includes('empty event') || b.includes('invalid json') || b.includes('missing body'))) {
    return { categoria: 'payload_invalido', mensagem: 'Payload inválido enviado à Lambda' };
  }
  if (b.includes('template_pausado')) return { categoria: 'template_pausado', mensagem: 'Template pausado na Meta' };
  if (b.includes('erro_meta')) return { categoria: 'erro_meta', mensagem: 'Meta API recusou o envio' };
  if (b.includes('nao_avanca')) return { categoria: 'nao_avanca', mensagem: 'Lead bloqueado pelo status (SagaOne)' };
  if (httpStatus === 0) return { categoria: 'timeout', mensagem: 'Sem resposta do servidor' };
  if (httpStatus >= 400) return { categoria: 'http_error', mensagem: `Erro HTTP ${httpStatus}` };
  if (!body) return { categoria: 'empty_body', mensagem: 'Resposta vazia' };
  return { categoria: 'outro', mensagem: (body || '').substring(0, 200) };
}

// Rótulos pt-BR para resumo de notificação.
const CATEGORIA_LABELS: Record<string, string> = {
  numero_invalido: 'número inválido',
  agente_nao_encontrado: 'agente não encontrado',
  evento_nao_encontrado: 'evento não encontrado',
  cadencia_nao_encontrada: 'cadência não encontrada',
  template_nao_encontrado: 'template não encontrado',
  payload_invalido: 'payload inválido',
  template_pausado: 'template pausado',
  erro_meta: 'erro Meta',
  nao_avanca: 'lead bloqueado',
  workflow_inactive: 'workflow inativo',
  timeout: 'timeout',
  http_error: 'erro HTTP',
  empty_body: 'resposta vazia',
  network: 'rede',
  outro: 'outro',
};

async function notificarFalhaDisparo(
  supabase: any,
  job: { id?: string; user_id?: string; empresa_id?: string },
  titulo: string,
  mensagem: string,
  linkBase: string,
) {
  if (!job?.user_id) return;
  try {
    const link = `${linkBase}${linkBase.includes('?') ? '&' : '?'}job=${job.id || ''}`;
    // idempotência: evita duplicar para o mesmo job
    const { data: existing } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('user_id', job.user_id)
      .eq('tipo', 'disparo_falhou')
      .eq('link', link)
      .limit(1);
    if (existing && existing.length > 0) return;
    await supabase.from('notificacoes').insert({
      user_id: job.user_id,
      empresa_id: job.empresa_id,
      tipo: 'disparo_falhou',
      titulo,
      mensagem: (mensagem || '').substring(0, 240),
      link,
      lida: false,
    });
  } catch (e) {
    console.warn('⚠️ [BG] Falha ao inserir notificação de disparo_falhou:', e);
  }
}

function resolveVariableMapping(
  mapping: Record<string, string> | null,
  lead: any,
  empresa: any,
  prospeccaoData: any
): Record<string, string> | null {
  if (!mapping || Object.keys(mapping).length === 0) return null;
  const resolved: Record<string, string> = {};
  for (const [position, fieldName] of Object.entries(mapping)) {
    let value = '';
    switch (fieldName) {
      case 'nome_cliente': value = lead.nome || ''; break;
      case 'empresa': value = empresa?.nome_empresa || ''; break;
      case 'marca': value = empresa?.marca || empresa?.nome_empresa || ''; break;
      case 'telefone': value = lead.telefone || ''; break;
      case 'data_atual': value = new Date().toLocaleDateString('pt-BR'); break;
      case 'nome_prospeccao': value = prospeccaoData?.titulo || ''; break;
      case 'data_inicio': value = prospeccaoData?.data_inicio ? new Date(prospeccaoData.data_inicio).toLocaleDateString('pt-BR') : ''; break;
      case 'data_fim': value = prospeccaoData?.data_fim ? new Date(prospeccaoData.data_fim).toLocaleDateString('pt-BR') : ''; break;
      case 'vendedor_nome': value = lead.vendedor_nome || ''; break;
      case 'uf': value = empresa?.uf || ''; break;
      case 'cidade': value = empresa?.cidade || ''; break;
      default: value = fieldName;
    }
    resolved[position] = value;
  }
  return Object.keys(resolved).length > 0 ? resolved : null;
}

// ============================================================
// Background processing function
// ============================================================
async function processJobInBackground(supabase: any, job_id: string, job: any, SAGA_ONE: string, batch_id?: string | null) {
  try {
    console.log(`🚀 [BG] Iniciando processamento do job: ${job_id}${batch_id ? ` (batch ${batch_id})` : ''}`);

    // Buscar dados da prospecção
    const { data: prospeccao } = await supabase
      .from('prospeccoes')
      .select('id, titulo, canal, data_inicio, data_fim, meta_convites, meta_confirmacoes, meta_checkins, event_id_pri, template_prospeccao_id')
      .eq('id', job.prospeccao_id)
      .single();

    if (!prospeccao) {
      await supabase.from('campaign_jobs').update({ status: 'failed', error_message: 'Prospecção não encontrada', completed_at: new Date().toISOString() }).eq('id', job_id);
      console.error(`❌ [BG] Prospecção não encontrada para job ${job_id}`);
      return { success: false, error: 'Prospecção não encontrada' };
    }

    const canalStr = String(prospeccao.canal || '').toLowerCase();
    const isIALigacao = canalStr.includes('liga') || canalStr === 'ligação' || canalStr === 'ligacao';

    // Buscar empresa
    const { data: empresaData } = await supabase
      .from('empresas')
      .select('crm_id, nome_empresa, uf, cidade, endereco, marca')
      .eq('id', job.empresa_id)
      .single();

    // Buscar dados do usuário criador do job para enriquecer logs_disparos
    let logUserNome: string | null = null;
    let logUserEmail: string | null = null;
    let logUserPerfil: string | null = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_completo, tipo_acesso')
        .eq('id', job.user_id)
        .maybeSingle();
      logUserNome = profile?.nome_completo || null;
      logUserPerfil = profile?.tipo_acesso || null;
      const { data: userRow } = await supabase.auth.admin.getUserById(job.user_id);
      logUserEmail = userRow?.user?.email || null;
    } catch (e) {
      console.warn('⚠️ [BG] Falha ao buscar profile/email para log:', (e as any)?.message);
    }

    // Buscar agentes
    const { data: agentesVinculados } = await supabase
      .from('agente_empresas')
      .select('agente_id, agentes_ia (id, nome, telefone, ativo)')
      .eq('empresa_id', job.empresa_id);

    const agentes = (agentesVinculados || [])
      .map((ae: any) => ae.agentes_ia)
      .filter((a: any) => a && a.ativo)
      .filter((a: any, idx: number, self: any[]) => idx === self.findIndex((t: any) => t?.id === a?.id));

    const agenteSearchPatterns = isIALigacao ? ['ligação', 'ligacao', 'ligaçao'] : ['whatsapp'];
    const agenteEspecifico = agentes.find((a: any) => {
      const nome = String(a?.nome || '').toLowerCase();
      return nome.includes('pri') && agenteSearchPatterns.some(p => nome.includes(p)) && normalizePhone(a?.telefone);
    });
    
    const telefonePri = agenteEspecifico ? normalizePhone(agenteEspecifico.telefone) : '';
    const nomeAgente = agenteEspecifico?.nome || '';

    let telefonePriWhatsapp = '';
    if (isIALigacao) {
      const agenteWA = agentes.find((a: any) => {
        const nome = String(a?.nome || '').toLowerCase();
        return nome.includes('pri') && nome.includes('whatsapp') && normalizePhone(a?.telefone);
      });
      if (agenteWA) telefonePriWhatsapp = normalizePhone(agenteWA.telefone);
    }

    // Buscar template para WhatsApp
    let variableMapping: Record<string, any> | null = null;
    let temVariavel = 'Não';
    let templateNome: string | null = null;

    if (!isIALigacao && prospeccao.template_prospeccao_id) {
      const { data: templateData } = await supabase
        .from('whatsapp_templates')
        .select('variable_mapping, conteudo, nome')
        .eq('id', prospeccao.template_prospeccao_id)
        .eq('ativo', true)
        .maybeSingle();

      if (templateData) {
        variableMapping = templateData.variable_mapping as Record<string, any> | null;
        temVariavel = /\{\{\d+\}\}/.test(templateData.conteudo || '') ? 'Sim' : 'Não';
        templateNome = templateData.nome || null;
      }
    }

    const webhookUrl = isIALigacao
      ? 'https://automatemaiawh.sagadatadriven.com.br/webhook/dispara-ligacao'
      : 'https://ccnv217nqk.execute-api.us-east-1.amazonaws.com/dev/disparo';

    const eventIdPri = prospeccao.event_id_pri || '';

    const dadosComuns = {
      prospeccao_id: job.prospeccao_id,
      evento_nome: prospeccao.titulo || '',
      event_id_pri: eventIdPri,
      data_inicio: prospeccao.data_inicio || null,
      data_fim: prospeccao.data_fim || null,
      canal: prospeccao.canal || (isIALigacao ? 'Ligação' : 'Whatsapp'),
      telefone_pri: telefonePri,
      pri_telefone: telefonePri,
      telefone_pri_whatsapp: telefonePriWhatsapp,
      nome_agente: nomeAgente,
      dealer_id: empresaData?.crm_id || '',
      pri_dealer_id: empresaData?.crm_id || '',
      empresa_id: job.empresa_id,
      nome_empresa: empresaData?.nome_empresa || '',
      uf: empresaData?.uf || '',
      cidade: empresaData?.cidade || '',
      tipo_ia: isIALigacao ? 'IA Ligação' : 'IA Whatsapp',
      acao: 'criar',
      tem_variavel: temVariavel,
      variable_mapping: variableMapping,
    };

    // Buscar batches a processar.
    // - Com batch_id (cron/scheduled): processa apenas aquele batch (já vem 'processing' via claim).
    // - Sem batch_id (imediato): processa pending/failed. NUNCA varre 'scheduled' aqui.
    let batchQuery = supabase
      .from('campaign_batches')
      .select('*')
      .eq('job_id', job_id)
      .order('batch_index', { ascending: true });
    if (batch_id) {
      batchQuery = batchQuery.eq('id', batch_id).in('status', ['processing', 'pending', 'failed']);
    } else {
      batchQuery = batchQuery.in('status', ['pending', 'failed']);
    }
    const { data: batches } = await batchQuery;

    if (!batches || batches.length === 0) {
      // Avalia se ainda existem batches scheduled antes de finalizar.
      const { count: scheduledLeft } = await supabase
        .from('campaign_batches')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', job_id)
        .eq('status', 'scheduled');
      if (!scheduledLeft || scheduledLeft === 0) {
        await supabase.from('campaign_jobs').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        }).eq('id', job_id);
      }
      console.log(`✅ [BG] Job ${job_id}: nenhum batch para processar (scheduled restantes=${scheduledLeft || 0})`);
      return { success: true, message: 'Nenhum batch para processar' };
    }

    console.log(`📦 [BG] ${batches.length} batches para processar (canal: ${prospeccao.canal})`);

    // Deltas locais (apenas desta invocação). Contadores absolutos são mantidos
    // de forma atômica no DB via RPC increment_job_counters().
    let invProcessed = 0;
    let invFailed = 0;
    let invDuplicate = 0;

    for (const batch of batches) {
      // Verificar se job foi cancelado
      const { data: currentJob } = await supabase.from('campaign_jobs').select('status, cancelled_at').eq('id', job_id).single();
      if (currentJob?.status === 'cancelled' || currentJob?.cancelled_at) {
        console.log('🛑 [BG] Job cancelado, parando processamento');
        break;
      }

      if ((batch.retry_count || 0) >= MAX_RETRIES) {
        console.log(`⏭️ [BG] Batch ${batch.batch_index} já excedeu ${MAX_RETRIES} retries, pulando`);
        continue;
      }

      // Se já chega como 'processing' (cron claim), não regride.
      if (batch.status !== 'processing') {
        await supabase.from('campaign_batches').update({
          status: 'processing',
          started_at: new Date().toISOString(),
        }).eq('id', batch.id);
      }

      const leadIds: string[] = Array.isArray(batch.lead_ids) ? batch.lead_ids : JSON.parse(String(batch.lead_ids));

      try {
        const leads: any[] = [];
        const SUB_BATCH = 100;

        if (isIALigacao) {
          for (let i = 0; i < leadIds.length; i += SUB_BATCH) {
            const batchIds = leadIds.slice(i, i + SUB_BATCH);
            const { data: prospectsData, error: prospectsError } = await supabase
              .from('prospect_pri_voz')
              .select('id, telefone_lead, nome, lead_id')
              .in('id', batchIds);
            if (prospectsError) {
              console.error(`⚠️ [BG] Erro ao buscar prospects sub-batch ${Math.floor(i / SUB_BATCH)}:`, prospectsError.message);
            }
            if (prospectsData) {
              leads.push(...prospectsData.map((p: any) => ({
                id: p.id,
                lead_id: p.lead_id,
                nome: p.nome || '',
                telefone: p.telefone_lead || '',
                email: '',
                status: 'Novo',
                origem: 'Ligação',
                vendedor_nome: '',
              })));
            }
          }

          if (leads.length === 0) {
            for (let i = 0; i < leadIds.length; i += SUB_BATCH) {
              const batchIds = leadIds.slice(i, i + SUB_BATCH);
              const { data: leadsData, error: leadsError } = await supabase
                .from('contatos')
                .select('id, lead_id, nome, telefone, email, status, origem, vendedor_nome, codigo_proposta')
                .in('id', batchIds);
              if (leadsError) {
                console.error(`⚠️ [BG] Erro no fallback local de contatos sub-batch ${Math.floor(i / SUB_BATCH)}:`, leadsError.message);
              }
              if (leadsData) leads.push(...leadsData);
            }
          }
        } else {
          for (let i = 0; i < leadIds.length; i += SUB_BATCH) {
            const batchIds = leadIds.slice(i, i + SUB_BATCH);
            const { data: leadsData, error: leadsError } = await supabase
              .from('contatos')
              .select('id, lead_id, nome, telefone, email, status, origem, vendedor_nome, codigo_proposta')
              .in('id', batchIds);
            if (leadsError) {
              console.error(`⚠️ [BG] Erro ao buscar leads sub-batch ${Math.floor(i / SUB_BATCH)}:`, leadsError.message);
            }
            if (leadsData) leads.push(...leadsData);
          }
        }

        if (leads.length === 0) {
          console.warn(`⚠️ [BG] Batch ${batch.batch_index}: 0 leads encontrados de ${leadIds.length} IDs`);
          await supabase.from('campaign_batches').update({ 
            status: 'completed', 
            processed_leads: 0,
            error_log: `0 leads found from ${leadIds.length} IDs`,
            completed_at: new Date().toISOString() 
          }).eq('id', batch.id);
          continue;
        }

        console.log(`📤 [BG] Batch ${batch.batch_index}: enviando ${leads.length} leads via ${isIALigacao ? 'Ligação' : 'WhatsApp'}`);

        const successLeadIds: string[] = [];
        const duplicateLeadIds: string[] = [];
        const failedLeadIds: string[] = [];
        const failedReasons: Array<{ lead_id: string; nome?: string; telefone?: string; reason: string }> = [];
        const pendingFailLogs: any[] = [];

        // Helper: persiste data_disparo_ia para um conjunto de ids (sucessos + duplicates)
        // e insere falhas reais em logs_disparos_falhas. Chamado a cada sub-lote.
        const flushSubBatch = async (markIds: string[], failLogs: any[]) => {
          if (markIds.length > 0) {
            const ts = new Date().toISOString();
            for (let k = 0; k < markIds.length; k += 200) {
              const chunk = markIds.slice(k, k + 200);
              await supabase.from('contatos').update({ data_disparo_ia: ts }).in('id', chunk);
              await supabase.from('eventos_prospeccao')
                .update({ data_disparo_ia: ts })
                .eq('prospeccao_id', job.prospeccao_id)
                .in('contato_id', chunk);
            }
          }
          if (failLogs.length > 0) {
            await supabase.from('logs_disparos_falhas').insert(failLogs).then(({ error }) => {
              if (error) console.warn(`⚠️ [BG] Falha ao inserir logs_disparos_falhas:`, error.message);
            });
          }
        };

        if (isIALigacao) {
          // IA Ligação: enviar em sub-lotes de 100
          const contatosWithIds = leads.map(lead => ({
            id: lead.id,
            telefone_lead: normalizePhone(lead.telefone),
            nome: lead.nome,
            lead_id: lead.lead_id || null,
          }));

          const LIGACAO_SUB_BATCH = 100;
          const LIGACAO_TIMEOUT_MS = 120000;

          for (let i = 0; i < contatosWithIds.length; i += LIGACAO_SUB_BATCH) {
            const subContatos = contatosWithIds.slice(i, i + LIGACAO_SUB_BATCH);
            const subIds = subContatos.map(c => c.id);
            const payloadLigacao = {
              id_evento: parseInt(eventIdPri, 10) || eventIdPri,
              telefone_pri: telefonePri,
              contatos: subContatos.map(c => ({
                telefone_lead: c.telefone_lead,
                nome: c.nome,
                lead_id: c.lead_id,
              }))
            };

            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), LIGACAO_TIMEOUT_MS);
              
              // Chamar DIRETAMENTE o webhook externo (sem passar pelo external-webhook-proxy)
              // Motivo: chamadas internas entre edge functions estavam falhando com 401 no gateway
              const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
                },
                body: JSON.stringify(payloadLigacao),
                signal: controller.signal,
              });
              clearTimeout(timeout);

              const responseBody = await response.text().catch(() => '');
              console.log(`📡 [BG] Batch ${batch.batch_index} sub ${Math.floor(i / LIGACAO_SUB_BATCH)}: HTTP ${response.status}, body: ${responseBody.substring(0, 300)}`);

              const bodyLow = responseBody.toLowerCase();
              const looksLikeError = bodyLow.includes('"error"') || bodyLow.includes('workflow not found') || bodyLow.includes('not active') || bodyLow.includes('disparo repetido');
              const subFailLogs: any[] = [];
              let subMarkIds: string[] = [];

              if (response.ok && responseBody.length > 0 && !looksLikeError) {
                successLeadIds.push(...subIds);
                subMarkIds = subIds;
              } else {
                const { categoria, mensagem } = classifyError(response.status, responseBody);
                if (categoria === 'duplicate') {
                  duplicateLeadIds.push(...subIds);
                  subMarkIds = subIds;
                } else {
                  failedLeadIds.push(...subIds);
                }
                for (const c of subContatos) {
                  subFailLogs.push({
                    job_id, batch_id: batch.id, empresa_id: job.empresa_id, prospeccao_id: job.prospeccao_id,
                    contato_id: c.id, lead_id: c.lead_id || null, telefone: c.telefone_lead, nome: c.nome,
                    categoria, mensagem, http_status: response.status,
                  });
                }
                console.warn(`⚠️ [BG] Ligação sub ${Math.floor(i / LIGACAO_SUB_BATCH)} → ${categoria}: ${mensagem}`);
              }

              // Calcula deltas deste sub-lote para incremento atômico no DB.
              const subSuccess = subMarkIds.length - (subFailLogs.filter((l: any) => l.categoria === 'duplicate').length);
              const subDup = subFailLogs.filter((l: any) => l.categoria === 'duplicate').length;
              const subFail = subFailLogs.length - subDup;
              await flushSubBatch(subMarkIds, subFailLogs);
              if (subSuccess || subDup || subFail) {
                invProcessed += subSuccess;
                invDuplicate += subDup;
                invFailed += subFail;
                await supabase.rpc('increment_job_counters', {
                  p_job_id: job_id,
                  p_processed: subSuccess,
                  p_failed: subFail,
                  p_duplicate: subDup,
                });
              }

              if (successLeadIds.length > 0 || duplicateLeadIds.length > 0) {
                // Upsert incremental em cadencia_pri_voz para os sucessos+duplicates deste sub-lote
                const okSet = new Set(subMarkIds);
                const cadenciasSub = subContatos
                  .filter(c => okSet.has(c.id))
                  .map(c => ({
                    telefone_lead: c.telefone_lead,
                    telefone_pri: telefonePri,
                    id_evento: parseInt(eventIdPri, 10),
                    num_tentativas: 1,
                    hora_primeira_tentativa: new Date().toISOString(),
                    hora_ultima_tentativa: new Date().toISOString(),
                    empresa_id: job.empresa_id,
                    criado_em: new Date().toISOString(),
                    atualizado_em: new Date().toISOString(),
                  }));
                if (cadenciasSub.length > 0) {
                  await supabase.from('cadencia_pri_voz').upsert(cadenciasSub, { onConflict: 'telefone_lead,id_evento' });
                }
              }
            } catch (err: any) {
              failedLeadIds.push(...subIds);
              const isTimeout = err.name === 'AbortError';
              const categoria = isTimeout ? 'timeout' : 'network';
              const mensagem = isTimeout ? 'Sem resposta do servidor (timeout)' : `Erro de rede: ${err.message}`;
              console.error(`❌ [BG] ${categoria}: ${err.message}`);
              const subFailLogs = subContatos.map(c => ({
                job_id, batch_id: batch.id, empresa_id: job.empresa_id, prospeccao_id: job.prospeccao_id,
                contato_id: c.id, lead_id: c.lead_id || null, telefone: c.telefone_lead, nome: c.nome,
                categoria, mensagem, http_status: 0,
              }));
              await flushSubBatch([], subFailLogs);
              invFailed += subContatos.length;
              await supabase.rpc('increment_job_counters', {
                p_job_id: job_id,
                p_processed: 0,
                p_failed: subContatos.length,
                p_duplicate: 0,
              });
            }

            // Contadores agora persistidos via RPC atômica (acima).
          }
        } else {
          // =====================================================
          // IA WhatsApp: processar leads SEQUENCIALMENTE em lotes de 5
          // com delay entre sub-lotes para não sobrecarregar n8n
          // =====================================================
          const WA_BATCH_SIZE = 5;
          const WA_DELAY_MS = 500;

          console.log(`📤 [BG] WhatsApp: ${leads.length} leads, lotes de ${WA_BATCH_SIZE}, delay ${WA_DELAY_MS}ms`);

          for (let i = 0; i < leads.length; i += WA_BATCH_SIZE) {
            // Delay entre sub-lotes para não sobrecarregar o webhook
            if (i > 0) {
              await delay(WA_DELAY_MS);
            }

            const subBatch = leads.slice(i, i + WA_BATCH_SIZE);
            
            const results = await Promise.allSettled(subBatch.map(async (lead: any) => {
              const resolvedMapping = resolveVariableMapping(
                variableMapping as Record<string, string> | null,
                lead,
                empresaData,
                prospeccao
              );

              const payload: Record<string, any> = {
                ...dadosComuns,
                id: lead.id,
                lead_id: lead.lead_id,
                nome: lead.nome,
                telefone: normalizePhone(lead.telefone),
                email: lead.email || '',
                status: lead.status || 'Novo',
                origem: lead.origem || 'Importação',
                data_importacao: new Date().toISOString(),
                tipo_importacao: 'planilha',
                variable_mapping: resolvedMapping,
              };

              if (lead.codigo_proposta) {
                payload.proposalId = lead.codigo_proposta;
              }

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000);

              try {
                const response = await fetch(webhookUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': Deno.env.get('MAIP_MSG_Wpp_Send_Dev_X_api_key') ?? '',
                  },
                  body: JSON.stringify(payload),
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);

                const responseBody = await response.text().catch(() => '');

                const bodyLow = (responseBody || '').toLowerCase();
                const looksLikeError = bodyLow.includes('"error"') || bodyLow.includes('workflow not found') || bodyLow.includes('not active') || bodyLow.includes('disparo repetido');

                if (response.ok && responseBody.length > 0 && !looksLikeError) {
                  return lead.id;
                }
                const err: any = new Error(`HTTP ${response.status}`);
                err.meta = { httpStatus: response.status, body: responseBody };
                throw err;
              } catch (err) {
                clearTimeout(timeoutId);
                if (!(err as any).meta) {
                  const isTimeout = (err as any)?.name === 'AbortError';
                  (err as any).meta = { httpStatus: 0, body: isTimeout ? 'timeout' : ((err as any)?.message || '') };
                }
                throw err;
              }
            }));

            const subMarkIds: string[] = [];
            const subFailLogs: any[] = [];
            for (let ri = 0; ri < results.length; ri++) {
              const r = results[ri];
              const lead = subBatch[ri];
              if (r.status === 'fulfilled') {
                successLeadIds.push(r.value);
                subMarkIds.push(r.value);
              } else {
                const meta = (r as PromiseRejectedResult).reason?.meta || { httpStatus: 0, body: '' };
                const { categoria, mensagem } = classifyError(meta.httpStatus || 0, meta.body || '');
                if (categoria === 'duplicate') {
                  duplicateLeadIds.push(lead.id);
                  subMarkIds.push(lead.id);
                } else {
                  failedLeadIds.push(lead.id);
                  failedReasons.push({ lead_id: lead.id, nome: lead.nome, telefone: lead.telefone, reason: mensagem });
                }
                subFailLogs.push({
                  job_id, batch_id: batch.id, empresa_id: job.empresa_id, prospeccao_id: job.prospeccao_id,
                  contato_id: lead.id, lead_id: lead.lead_id || null, telefone: lead.telefone, nome: lead.nome,
                  categoria, mensagem, http_status: meta.httpStatus || 0,
                });
                if (categoria !== 'duplicate') {
                  console.error(`❌ [BG] Lead ${lead.id} (${lead.nome}): ${categoria} - ${mensagem}`);
                }
              }
            }

            // Flush por sub-lote: marca data_disparo_ia para sucessos+duplicates e grava falhas
            await flushSubBatch(subMarkIds, subFailLogs);

            // Incremento atômico via RPC (deltas deste sub-lote)
            const subSuccessCount = results.filter(r => r.status === 'fulfilled').length;
            const subDupCount = subFailLogs.filter((l: any) => l.categoria === 'duplicate').length;
            const subFailCount = subFailLogs.length - subDupCount;
            if (subSuccessCount || subDupCount || subFailCount) {
              invProcessed += subSuccessCount;
              invDuplicate += subDupCount;
              invFailed += subFailCount;
              await supabase.rpc('increment_job_counters', {
                p_job_id: job_id,
                p_processed: subSuccessCount,
                p_failed: subFailCount,
                p_duplicate: subDupCount,
              });
            }

            if ((i / WA_BATCH_SIZE) % 20 === 0 || i + WA_BATCH_SIZE >= leads.length) {
              console.log(`📊 [BG] WhatsApp progresso: ${successLeadIds.length} ok, ${duplicateLeadIds.length} dup, ${failedLeadIds.length} falhas de ${leads.length}`);
            }
          }
        }

        // Persistência incremental já foi feita por sub-lote dentro do loop (flushSubBatch).
        // Sucessos e duplicates já tiveram data_disparo_ia gravado; falhas reais já estão em logs_disparos_falhas.

        // Determinar status do batch
        const batchStatus = failedLeadIds.length === 0
          ? 'completed' 
          : successLeadIds.length === 0 
            ? 'failed' 
            : 'completed';

        const batchError = failedLeadIds.length > 0 
          ? `${failedLeadIds.length} de ${leads.length} leads falharam` 
          : '';

        // Persiste amostra dos retornos REAIS da Lambda + agrupamento por padrão de erro
        let errorLogDetailed: string | null = batchError || null;
        if (failedReasons.length > 0) {
          const buckets = new Map<string, number>();
          for (const fr of failedReasons) {
            const key = (fr.reason || 'desconhecido').substring(0, 160);
            buckets.set(key, (buckets.get(key) || 0) + 1);
          }
          const grouped = Array.from(buckets.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([msg, n]) => `  • ${n}x → ${msg}`)
            .join('\n');
          const samples = failedReasons.slice(0, 5)
            .map(fr => `  - ${fr.nome || ''} (${fr.telefone || ''} / ${fr.lead_id}): ${fr.reason.substring(0, 200)}`)
            .join('\n');
          errorLogDetailed = `${batchError}\n\n[Top erros]\n${grouped}\n\n[Amostras]\n${samples}`.substring(0, 4000);
        }

        await supabase.from('campaign_batches').update({
          status: batchStatus,
          processed_leads: successLeadIds.length + duplicateLeadIds.length,
          error_log: errorLogDetailed,
          completed_at: new Date().toISOString(),
          ...(failedLeadIds.length > 0 && successLeadIds.length === 0 
            ? { retry_count: (batch.retry_count || 0) + 1 } 
            : {}),
        }).eq('id', batch.id);

        // Contadores absolutos já mantidos via increment_job_counters (RPC).

        // ========== LOG SERVER-SIDE DE DISPARO (auditoria por batch) ==========
        try {
          const totalBatch = successLeadIds.length + failedLeadIds.length;
          const VALOR_UNITARIO_USD = isIALigacao ? 0 : 0.06;
          await supabase.from('logs_disparos').insert({
            usuario_id: job.user_id,
            usuario_nome: logUserNome,
            usuario_email: logUserEmail,
            usuario_perfil: logUserPerfil,
            prospeccao_id: job.prospeccao_id,
            evento_nome: prospeccao.titulo || '',
            canal: prospeccao.canal || (isIALigacao ? 'Ligação' : 'Whatsapp'),
            total_contatos: totalBatch,
            total_sucesso: successLeadIds.length,
            total_falha: failedLeadIds.length,
            empresa_id: job.empresa_id,
            marca: empresaData?.marca || null,
            uf: empresaData?.uf || null,
            template_id: prospeccao.template_prospeccao_id || null,
            template_nome: templateNome,
            tipo_evento: prospeccao.canal || null,
            origem: 'edge_function',
            job_id: job_id,
            batch_index: batch.batch_index,
            valor_unitario_usd: VALOR_UNITARIO_USD,
            custo_total_usd: totalBatch * VALOR_UNITARIO_USD,
          });
        } catch (logErr: any) {
          console.warn(`⚠️ [BG] Falha ao registrar log_disparo (não crítico):`, logErr?.message);
        }

      } catch (batchErr: any) {
        console.error(`❌ [BG] Erro crítico no batch ${batch.batch_index}:`, batchErr);
        await supabase.from('campaign_batches').update({
          status: 'failed',
          retry_count: (batch.retry_count || 0) + 1,
          error_log: batchErr.message,
        }).eq('id', batch.id);
        // Não incrementa contadores agregados aqui (lote será reprocessado em retry).
      }
    }

    // ============================================================
    // Regra de conclusão do job
    // - Se ainda existem batches 'scheduled', NÃO mexe no status do job
    //   (cron continuará disparando os próximos lotes).
    // - Se todos terminais e houve falha → 'partially_completed'.
    // - Se todos terminais e zero falha → 'completed'.
    // ============================================================
    const { count: scheduledLeft } = await supabase
      .from('campaign_batches')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job_id)
      .eq('status', 'scheduled');

    if (scheduledLeft && scheduledLeft > 0) {
      // Mantém aberto. Apenas atualiza updated_at.
      await supabase.from('campaign_jobs').update({
        updated_at: new Date().toISOString(),
      }).eq('id', job_id);
      console.log(`⏸️ [BG] Job ${job_id}: ${scheduledLeft} batches scheduled restantes — job permanece em aberto.`);
      return { success: true, job_id, status: 'scheduled_remaining', processed: invProcessed, failed: invFailed };
    }

    const { data: failedBatches } = await supabase
      .from('campaign_batches')
      .select('id, retry_count')
      .eq('job_id', job_id)
      .eq('status', 'failed');
    const { count: pendingLeft } = await supabase
      .from('campaign_batches')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job_id)
      .in('status', ['pending', 'processing']);

    const retriableBatches = (failedBatches || []).filter((b: { retry_count: number | null }) => (b.retry_count || 0) < MAX_RETRIES);
    const allTerminal = (pendingLeft || 0) === 0 && retriableBatches.length === 0;

    // Contadores absolutos persistidos do job
    const { data: jobNow } = await supabase
      .from('campaign_jobs')
      .select('processed_records, failed_records, total_records, duplicate_records, dispatch_mode')
      .eq('id', job_id)
      .single();

    if (allTerminal) {
      const totalFailedDb = jobNow?.failed_records || 0;
      const totalProcessedDb = jobNow?.processed_records || 0;
      const finalStatus = totalFailedDb > 0
        ? ((failedBatches || []).length > 0 ? 'partially_completed' : 'completed')
        : 'completed';

      await supabase.from('campaign_jobs').update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        error_message: totalFailedDb > 0 ? `${totalFailedDb} registros falharam` : null,
      }).eq('id', job_id);

      try {
        await supabase.from('notificacoes').insert({
          user_id: job.user_id,
          empresa_id: job.empresa_id,
          tipo: 'disparo_concluido',
          titulo: totalFailedDb > 0 ? 'Disparo concluído com erros' : 'Disparo concluído!',
          mensagem: `${totalProcessedDb} de ${jobNow?.total_records || job.total_records} contatos disparados${totalFailedDb > 0 ? ` (${totalFailedDb} falhas)` : ''} - ${prospeccao.titulo}`,
          lida: false,
        });
      } catch (notifErr) {
        console.warn('⚠️ [BG] Erro ao criar notificação:', notifErr);
      }

      console.log(`✅ [BG] Job ${job_id} finalizado [${finalStatus}]: ${totalProcessedDb} processados, ${totalFailedDb} falhas`);
      return { success: true, job_id, status: finalStatus, processed: totalProcessedDb, failed: totalFailedDb };
    }

    // Ainda há retries pendentes ou processing — não marca completed.
    await supabase.from('campaign_jobs').update({ updated_at: new Date().toISOString() }).eq('id', job_id);
    return { success: true, job_id, status: 'in_progress', processed: invProcessed, failed: invFailed };
  } catch (error: any) {
    console.error(`❌ [BG] Erro crítico no job ${job_id}:`, error);
    await supabase.from('campaign_jobs').update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString(),
    }).eq('id', job_id);
    return { success: false, error: error.message };
  }
}

// ============================================================
// HTTP Handler
// ============================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const tokenValue = authHeader.replace('Bearer ', '');
  if (tokenValue !== supabaseKey) {
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(tokenValue);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';

  try {
    const { job_id, batch_id } = await req.json();

    if (!job_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'job_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Recebendo campaign job: ${job_id}${batch_id ? ` batch=${batch_id}` : ''}`);

    // Buscar job para validação
    const { data: job, error: jobError } = await supabase
      .from('campaign_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('Job não encontrado:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Job não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: true, message: `Job já está ${job.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Promover para 'processing' apenas se estiver pending/scheduled/partially_completed.
    // Quando o cron chama com batch_id, o batch já vem 'processing' via claim — o job pode estar
    // 'scheduled' ou 'partially_completed' e deve passar a 'processing' para entrar no índice ativo.
    if (['pending', 'scheduled', 'partially_completed'].includes(job.status)) {
      await supabase
        .from('campaign_jobs')
        .update({ status: 'processing', started_at: job.started_at || new Date().toISOString() })
        .eq('id', job_id);
    }

    // Processar em background via EdgeRuntime.waitUntil
    const processPromise = processJobInBackground(supabase, job_id, job, SAGA_ONE, batch_id || null);
    
    // @ts-ignore - EdgeRuntime disponível em Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processPromise);
      console.log(`⏳ Job ${job_id} delegado para background`);
      return new Response(
        JSON.stringify({ success: true, job_id, status: 'processing', message: 'Processamento iniciado em background' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Fallback: processar inline
      console.log(`⏳ Job ${job_id} processando inline`);
      const result = await processPromise;
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('❌ Erro crítico:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
