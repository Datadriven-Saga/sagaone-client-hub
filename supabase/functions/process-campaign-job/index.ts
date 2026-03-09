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
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.substring(2);
  }
  return digits;
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';

  try {
    const { job_id } = await req.json();
    
    if (!job_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'job_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 Processando campaign job: ${job_id}`);

    // Buscar job
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

    // Verificar se já está processando ou completo
    if (job.status === 'completed' || job.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: true, message: `Job já está ${job.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Marcar job como processing
    await supabase
      .from('campaign_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job_id);

    // Buscar dados da prospecção
    const { data: prospeccao } = await supabase
      .from('prospeccoes')
      .select('id, titulo, canal, data_inicio, data_fim, meta_convites, meta_confirmacoes, meta_checkins, event_id_pri, template_prospeccao_id')
      .eq('id', job.prospeccao_id)
      .single();

    if (!prospeccao) {
      await supabase.from('campaign_jobs').update({ status: 'failed', error_message: 'Prospecção não encontrada', completed_at: new Date().toISOString() }).eq('id', job_id);
      return new Response(JSON.stringify({ success: false, error: 'Prospecção não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const canalStr = String(prospeccao.canal || '').toLowerCase();
    const isIALigacao = canalStr.includes('liga') || canalStr === 'ligação' || canalStr === 'ligacao';
    const isIAWhatsapp = canalStr === 'whatsapp';

    // Buscar empresa
    const { data: empresaData } = await supabase
      .from('empresas')
      .select('crm_id, nome_empresa, uf, cidade, endereco, marca')
      .eq('id', job.empresa_id)
      .single();

    // Buscar agentes
    const { data: agentesVinculados } = await supabase
      .from('agente_empresas')
      .select('agente_id, agentes_ia (id, nome, telefone, ativo)')
      .eq('empresa_id', job.empresa_id);

    const agentes = (agentesVinculados || [])
      .map((ae: any) => ae.agentes_ia)
      .filter((a: any) => a && a.ativo)
      .filter((a: any, idx: number, self: any[]) => idx === self.findIndex((t: any) => t?.id === a?.id));

    // Buscar agente específico
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
      }
    }

    const webhookUrl = isIALigacao
      ? 'https://automatemaiawh.sagadatadriven.com.br/webhook/dispara-ligacao'
      : 'https://automatemaiawh.sagadatadriven.com.br/webhook/recebe-leads-pri';

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

    // Buscar batches pendentes ou com falha (para retry/resume)
    const { data: batches } = await supabase
      .from('campaign_batches')
      .select('*')
      .eq('job_id', job_id)
      .in('status', ['pending', 'failed'])
      .order('batch_index', { ascending: true });

    if (!batches || batches.length === 0) {
      await supabase.from('campaign_jobs').update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      }).eq('id', job_id);
      return new Response(JSON.stringify({ success: true, message: 'Nenhum batch pendente' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📦 ${batches.length} batches para processar`);

    let totalProcessed = job.processed_records || 0;
    let totalFailed = job.failed_records || 0;
    let batchBaseProcessed = totalProcessed;
    let batchBaseFailed = totalFailed;

    for (const batch of batches) {
      // Verificar se job foi cancelado
      const { data: currentJob } = await supabase.from('campaign_jobs').select('status').eq('id', job_id).single();
      if (currentJob?.status === 'cancelled') {
        console.log('🛑 Job cancelado, parando processamento');
        break;
      }

      // Não reprocessar batches que já falharam MAX_RETRIES vezes
      if (batch.retry_count >= MAX_RETRIES) {
        console.log(`⏭️ Batch ${batch.batch_index} já excedeu ${MAX_RETRIES} retries, pulando`);
        continue;
      }

      // Marcar batch como processing
      await supabase.from('campaign_batches').update({ 
        status: 'processing', 
        started_at: new Date().toISOString() 
      }).eq('id', batch.id);

      const leadIds: string[] = Array.isArray(batch.lead_ids) ? batch.lead_ids : JSON.parse(String(batch.lead_ids));

      try {
        // Buscar dados dos leads em sub-batches menores (100 para evitar limite de URL do PostgREST)
        const leads: any[] = [];
        const SUB_BATCH = 100;
        for (let i = 0; i < leadIds.length; i += SUB_BATCH) {
          const batchIds = leadIds.slice(i, i + SUB_BATCH);
          const { data: leadsData, error: leadsError } = await supabase
            .from('contatos')
            .select('id, lead_id, nome, telefone, email, status, origem, vendedor_nome')
            .in('id', batchIds);
          if (leadsError) {
            console.error(`⚠️ Erro ao buscar leads sub-batch ${Math.floor(i / SUB_BATCH)}:`, leadsError.message);
          }
          if (leadsData) leads.push(...leadsData);
        }

        if (leads.length === 0) {
          console.warn(`⚠️ Batch ${batch.batch_index}: 0 leads encontrados de ${leadIds.length} IDs`);
          await supabase.from('campaign_batches').update({ 
            status: 'completed', 
            processed_leads: 0,
            error_log: `0 leads found from ${leadIds.length} IDs`,
            completed_at: new Date().toISOString() 
          }).eq('id', batch.id);
          continue;
        }

        console.log(`📤 Batch ${batch.batch_index}: enviando ${leads.length} leads`);

        // Arrays para rastrear resultados individuais por lead
        const successLeadIds: string[] = [];
        const failedLeadIds: string[] = [];

        if (isIALigacao) {
          // IA Ligação: enviar em sub-lotes de 100 contatos
          // Para Ligação, o webhook recebe lote de contatos, mas rastreamos por sub-lote
          const contatosWithIds = leads.map(lead => ({
            id: lead.id,
            telefone_lead: normalizePhone(lead.telefone),
            nome: lead.nome,
            lead_id: lead.lead_id || null,
          }));

          const LIGACAO_SUB_BATCH = 100;

          for (let i = 0; i < contatosWithIds.length; i += LIGACAO_SUB_BATCH) {
            const subContatos = contatosWithIds.slice(i, i + LIGACAO_SUB_BATCH);
            const subIds = subContatos.map(c => c.id);
            const payloadLigacao = {
              id_evento: eventIdPri,
              telefone_pri: telefonePri,
              loja: empresaData?.nome_empresa || '',
              contatos: subContatos.map(c => ({
                telefone_lead: c.telefone_lead,
                nome: c.nome,
                lead_id: c.lead_id,
              }))
            };

            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 30000);
              
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
              console.log(`📡 Batch ${batch.batch_index} sub ${Math.floor(i / LIGACAO_SUB_BATCH)}: HTTP ${response.status}, body: ${responseBody.substring(0, 300)}`);

              if (response.ok && responseBody.length > 0) {
                const isValidResponse = !responseBody.toLowerCase().includes('"error"') && 
                                        !responseBody.toLowerCase().includes('workflow not found') &&
                                        !responseBody.toLowerCase().includes('not active');
                if (isValidResponse) {
                  successLeadIds.push(...subIds);
                  console.log(`✅ Batch ${batch.batch_index} sub ${Math.floor(i / LIGACAO_SUB_BATCH)}: webhook OK (${subContatos.length} contatos)`);
                } else {
                  failedLeadIds.push(...subIds);
                  console.error(`❌ Batch ${batch.batch_index} sub ${Math.floor(i / LIGACAO_SUB_BATCH)}: Webhook retornou erro interno: ${responseBody.substring(0, 200)}`);
                }
              } else if (response.ok && responseBody.length === 0) {
                failedLeadIds.push(...subIds);
                console.error(`❌ Batch ${batch.batch_index} sub ${Math.floor(i / LIGACAO_SUB_BATCH)}: Webhook retornou 200 mas body vazio (workflow possivelmente inativo)`);
              } else {
                failedLeadIds.push(...subIds);
                console.error(`❌ Batch ${batch.batch_index} sub ${Math.floor(i / LIGACAO_SUB_BATCH)}: HTTP ${response.status}: ${responseBody.substring(0, 200)}`);
              }
            } catch (err: any) {
              failedLeadIds.push(...subIds);
              const isTimeout = err.name === 'AbortError';
              console.error(`❌ Batch ${batch.batch_index} sub ${Math.floor(i / LIGACAO_SUB_BATCH)}: ${isTimeout ? 'Timeout (30s)' : 'Network error'}: ${err.message}`);
            }

            // *** PROGRESSO GRANULAR: atualizar após cada sub-lote de 100 (Ligação) ***
            totalProcessed = batchBaseProcessed + successLeadIds.length;
            totalFailed = batchBaseFailed + failedLeadIds.length;
            await supabase.from('campaign_jobs').update({
              processed_records: totalProcessed,
              failed_records: totalFailed,
              updated_at: new Date().toISOString(),
            }).eq('id', job_id);

            console.log(`📊 Sub-lote Ligação ${Math.floor(i / LIGACAO_SUB_BATCH) + 1}: progresso ${totalProcessed}/${job.total_records}`);
          }

          console.log(`📊 Batch ${batch.batch_index} Ligação: ${successLeadIds.length} ok, ${failedLeadIds.length} falhas`);
        } else {
          // IA WhatsApp: processar leads individualmente em paralelo (batches de 50)
          const WA_BATCH_SIZE = 50;

          for (let i = 0; i < leads.length; i += WA_BATCH_SIZE) {
            const subBatch = leads.slice(i, i + WA_BATCH_SIZE);
            
            const results = await Promise.allSettled(subBatch.map(async (lead: any) => {
              const resolvedMapping = resolveVariableMapping(
                variableMapping as Record<string, string> | null,
                lead,
                empresaData,
                prospeccao
              );

              const payload = {
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

              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 30000);

              const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
              });
              clearTimeout(timeout);

              const responseBody = await response.text().catch(() => '');

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseBody.substring(0, 200)}`);
              }

              // Validar que o webhook realmente processou
              if (responseBody.length === 0) {
                throw new Error('Webhook retornou 200 mas body vazio (workflow possivelmente inativo)');
              }

              const hasError = responseBody.toLowerCase().includes('"error"') ||
                               responseBody.toLowerCase().includes('workflow not found') ||
                               responseBody.toLowerCase().includes('not active');
              if (hasError) {
                throw new Error(`Webhook retornou erro interno: ${responseBody.substring(0, 200)}`);
              }

              console.log(`📡 Lead ${lead.id}: webhook OK, body: ${responseBody.substring(0, 100)}`);
              return lead.id;
            }));

            for (const r of results) {
              if (r.status === 'fulfilled') {
                successLeadIds.push(r.value);
              } else {
                // Para falhas, pegar o ID do lead correspondente pelo índice
                const idx = results.indexOf(r);
                failedLeadIds.push(subBatch[idx].id);
              }
            }

            // *** PROGRESSO GRANULAR: atualizar após cada sub-lote de 50 ***
            totalProcessed = batchBaseProcessed + successLeadIds.length;
            totalFailed = batchBaseFailed + failedLeadIds.length;
            await supabase.from('campaign_jobs').update({
              processed_records: totalProcessed,
              failed_records: totalFailed,
              updated_at: new Date().toISOString(),
            }).eq('id', job_id);

            console.log(`📊 Sub-lote WhatsApp ${Math.floor(i / WA_BATCH_SIZE) + 1}: progresso ${totalProcessed}/${job.total_records}`);
          }

          console.log(`📊 Batch ${batch.batch_index} WhatsApp: ${successLeadIds.length} ok, ${failedLeadIds.length} falhas`);
        }

        // ========== PERSISTÊNCIA EM LOTE: SUCESSOS ==========
        if (successLeadIds.length > 0) {
          const dataDisparoIA = new Date().toISOString();
          
          // Atualizar contatos e eventos_prospeccao em sub-lotes de 100
          for (let i = 0; i < successLeadIds.length; i += 100) {
            const chunk = successLeadIds.slice(i, i + 100);
            await supabase.from('contatos').update({ data_disparo_ia: dataDisparoIA }).in('id', chunk);
            await supabase.from('eventos_prospeccao').update({ data_disparo_ia: dataDisparoIA }).eq('prospeccao_id', job.prospeccao_id).in('contato_id', chunk);
          }

          // Backup cadencia_pri_voz para ligação (apenas leads com sucesso)
          if (isIALigacao) {
            const successLeadSet = new Set(successLeadIds);
            const cadenciasBackup = leads
              .filter((lead: any) => successLeadSet.has(lead.id))
              .map((lead: any) => ({
                telefone_lead: normalizePhone(lead.telefone),
                telefone_pri: telefonePri,
                id_evento: parseInt(eventIdPri, 10),
                num_tentativas: 1,
                hora_primeira_tentativa: dataDisparoIA,
                hora_ultima_tentativa: dataDisparoIA,
                empresa_id: job.empresa_id,
                criado_em: dataDisparoIA,
                atualizado_em: dataDisparoIA,
              }));
            for (let i = 0; i < cadenciasBackup.length; i += 100) {
              await supabase.from('cadencia_pri_voz').upsert(cadenciasBackup.slice(i, i + 100), { onConflict: 'telefone_lead,id_evento' });
            }
          }
        }

        // ========== PERSISTÊNCIA EM LOTE: FALHAS ==========
        // Leads com falha NÃO recebem data_disparo_ia (permanecem pendentes para reprocessamento)

        // Determinar status do batch
        const batchStatus = failedLeadIds.length === 0 
          ? 'completed' 
          : successLeadIds.length === 0 
            ? 'failed' 
            : 'completed'; // Parcial: batch completo, mas com falhas registradas

        const batchError = failedLeadIds.length > 0 
          ? `${failedLeadIds.length} de ${leads.length} leads falharam` 
          : '';

        await supabase.from('campaign_batches').update({
          status: batchStatus,
          processed_leads: successLeadIds.length,
          error_log: batchError || null,
          completed_at: new Date().toISOString(),
          ...(failedLeadIds.length > 0 && successLeadIds.length === 0 
            ? { retry_count: (batch.retry_count || 0) + 1 } 
            : {}),
        }).eq('id', batch.id);

        // Atualizar acumuladores para o próximo batch
        totalProcessed = batchBaseProcessed + successLeadIds.length;
        totalFailed = batchBaseFailed + failedLeadIds.length;
        batchBaseProcessed = totalProcessed;
        batchBaseFailed = totalFailed;

        // Atualização final do batch no job
        await supabase.from('campaign_jobs').update({
          processed_records: totalProcessed,
          failed_records: totalFailed,
          updated_at: new Date().toISOString(),
        }).eq('id', job_id);

      } catch (batchErr: any) {
        console.error(`❌ Erro crítico no batch ${batch.batch_index}:`, batchErr);
        await supabase.from('campaign_batches').update({
          status: 'failed',
          retry_count: (batch.retry_count || 0) + 1,
          error_log: batchErr.message,
        }).eq('id', batch.id);
        totalFailed += (batch.lead_ids as string[]).length;
        
        await supabase.from('campaign_jobs').update({
          processed_records: totalProcessed,
          failed_records: totalFailed,
        }).eq('id', job_id);
      }
    }

    // Verificar se todos os batches foram processados
    const { data: remainingBatches } = await supabase
      .from('campaign_batches')
      .select('id')
      .eq('job_id', job_id)
      .in('status', ['pending', 'processing']);

    const { data: failedBatches } = await supabase
      .from('campaign_batches')
      .select('id, retry_count')
      .eq('job_id', job_id)
      .eq('status', 'failed');

    const retriableBatches = (failedBatches || []).filter(b => (b.retry_count || 0) < MAX_RETRIES);

    const finalStatus = (remainingBatches?.length === 0 && retriableBatches.length === 0)
      ? (totalFailed > 0 ? 'completed' : 'completed')
      : 'failed';

    await supabase.from('campaign_jobs').update({
      status: finalStatus,
      processed_records: totalProcessed,
      failed_records: totalFailed,
      completed_at: new Date().toISOString(),
      error_message: totalFailed > 0 ? `${totalFailed} registros falharam` : null,
    }).eq('id', job_id);

    // Criar notificação para o usuário
    try {
      await supabase.from('notificacoes').insert({
        user_id: job.user_id,
        empresa_id: job.empresa_id,
        tipo: 'disparo_concluido',
        titulo: totalFailed > 0 ? 'Disparo concluído com erros' : 'Disparo concluído!',
        mensagem: `${totalProcessed} de ${job.total_records} contatos disparados${totalFailed > 0 ? ` (${totalFailed} falhas)` : ''} - ${prospeccao.titulo}`,
        lida: false,
      });
    } catch (notifErr) {
      console.warn('⚠️ Erro ao criar notificação:', notifErr);
    }

    console.log(`✅ Job ${job_id} finalizado: ${totalProcessed} processados, ${totalFailed} falhas`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id,
        status: finalStatus,
        processed: totalProcessed,
        failed: totalFailed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro crítico:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
