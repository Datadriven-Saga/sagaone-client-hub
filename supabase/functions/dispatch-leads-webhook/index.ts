import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para apenas dígitos
const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

interface Lead {
  id: string;
  lead_id: number | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: string | null;
  origem: string | null;
}

interface RequestBody {
  leads: Lead[];
  prospeccao_id: string;
  empresa_id: string;
  prospeccao_data: {
    titulo: string;
    canal: string;
    event_id_pri: string | null;
    data_inicio: string | null;
    data_fim: string | null;
  };
}

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 [${requestId}] DISPATCH-LEADS-WEBHOOK - Iniciando processamento`);
  console.log(`⏰ [${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(80)}\n`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight respondido`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: RequestBody = await req.json();
    const { leads, prospeccao_id, empresa_id, prospeccao_data } = body;

    console.log(`📥 [${requestId}] Dados recebidos:`);
    console.log(`   ├─ Total de leads: ${leads?.length || 0}`);
    console.log(`   ├─ Prospecção ID: ${prospeccao_id}`);
    console.log(`   ├─ Empresa ID: ${empresa_id}`);
    console.log(`   ├─ Evento: ${prospeccao_data?.titulo}`);
    console.log(`   ├─ Canal: ${prospeccao_data?.canal}`);
    console.log(`   └─ Event ID Pri: ${prospeccao_data?.event_id_pri || 'N/A'}`);

    // Validações
    if (!leads || leads.length === 0) {
      console.error(`❌ [${requestId}] Erro: Nenhum lead fornecido`);
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum lead fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!empresa_id) {
      console.error(`❌ [${requestId}] Erro: empresa_id não fornecido`);
      return new Response(
        JSON.stringify({ success: false, error: 'empresa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar tipo de IA
    const canalStr = String(prospeccao_data?.canal || '').toLowerCase();
    const isIAWhatsapp = canalStr === 'whatsapp';
    const isIALigacao = canalStr.includes('liga') || canalStr === 'ligação' || canalStr === 'ligacao';
    const tipoIA = isIALigacao ? 'IA Ligação' : (isIAWhatsapp ? 'IA Whatsapp' : 'Outro');

    console.log(`\n🤖 [${requestId}] Tipo de IA detectado: ${tipoIA}`);
    console.log(`   ├─ isIAWhatsapp: ${isIAWhatsapp}`);
    console.log(`   └─ isIALigacao: ${isIALigacao}`);

    if (!isIAWhatsapp && !isIALigacao) {
      console.log(`⏭️ [${requestId}] Canal não é IA Whatsapp nem IA Ligação, ignorando webhook externo`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Canal não requer webhook externo',
          tipo_ia: tipoIA,
          leads_processados: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`\n📊 [${requestId}] Buscando dados da empresa e agentes...`);

    // Buscar dados da empresa (UMA VEZ para todos os leads)
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas')
      .select('crm_id, nome_empresa, uf, cidade, endereco, marca')
      .eq('id', empresa_id)
      .single();

    if (empresaError) {
      console.error(`❌ [${requestId}] Erro ao buscar empresa:`, empresaError);
    } else {
      console.log(`✅ [${requestId}] Empresa encontrada:`);
      console.log(`   ├─ Nome: ${empresaData?.nome_empresa}`);
      console.log(`   ├─ CRM ID: ${empresaData?.crm_id || 'N/A'}`);
      console.log(`   ├─ UF: ${empresaData?.uf || 'N/A'}`);
      console.log(`   └─ Cidade: ${empresaData?.cidade || 'N/A'}`);
    }

    // Buscar agentes vinculados (UMA VEZ para todos os leads)
    const { data: agentesVinculados, error: agentesError } = await supabase
      .from('agente_empresas')
      .select(`
        agente_id,
        agentes_ia (
          id,
          nome,
          telefone,
          ativo
        )
      `)
      .eq('empresa_id', empresa_id);

    if (agentesError) {
      console.error(`❌ [${requestId}] Erro ao buscar agentes:`, agentesError);
    }

    const agentes = (agentesVinculados || [])
      .map((ae: any) => ae.agentes_ia)
      .filter((a: any) => a && a.ativo)
      .filter((a: any, idx: number, self: any[]) => idx === self.findIndex(t => t?.id === a?.id));

    console.log(`\n🤖 [${requestId}] Agentes ativos encontrados: ${agentes.length}`);
    agentes.forEach((a: any, i: number) => {
      console.log(`   ${i === agentes.length - 1 ? '└' : '├'}─ ${a.nome} (Tel: ${a.telefone || 'N/A'})`);
    });

    // Buscar agente específico para o tipo de disparo
    let telefonePri = '';
    let nomeAgente = '';
    let telefonePriWhatsapp = ''; // Telefone do agente Pri - Whatsapp (para eventos de Ligação)
    
    const agenteSearchPatterns = isIALigacao 
      ? ['ligação', 'ligacao', 'ligaçao'] 
      : ['whatsapp'];

    const agenteEspecifico = agentes.find((a: any) => {
      const nome = String(a?.nome || '').toLowerCase();
      const temPri = nome.includes('pri');
      const temPatternCorreto = agenteSearchPatterns.some(pattern => nome.includes(pattern));
      return temPri && temPatternCorreto && normalizePhone(a?.telefone);
    });

    if (agenteEspecifico) {
      telefonePri = normalizePhone(agenteEspecifico.telefone);
      nomeAgente = agenteEspecifico.nome;
      console.log(`\n✅ [${requestId}] Agente ${isIALigacao ? 'Pri(Ligação)' : 'Pri - Whatsapp'} encontrado!`);
      console.log(`   ├─ Nome: ${nomeAgente}`);
      console.log(`   └─ Telefone: ${telefonePri}`);
    } else {
      console.warn(`\n⚠️ [${requestId}] Agente específico NÃO encontrado!`);
      console.log(`   ├─ Tipo esperado: ${isIALigacao ? 'Pri(Ligação)' : 'Pri - Whatsapp'}`);
      console.log(`   ├─ Patterns buscados: ${agenteSearchPatterns.join(', ')}`);
      console.log(`   └─ Agentes disponíveis: ${agentes.map((a: any) => a?.nome).join(', ') || 'Nenhum'}`);
    }

    // Para eventos de Ligação, também buscar telefone do agente Pri - Whatsapp
    if (isIALigacao) {
      const agenteWhatsapp = agentes.find((a: any) => {
        const nome = String(a?.nome || '').toLowerCase();
        const temPri = nome.includes('pri');
        const temWhatsapp = nome.includes('whatsapp');
        return temPri && temWhatsapp && normalizePhone(a?.telefone);
      });

      if (agenteWhatsapp) {
        telefonePriWhatsapp = normalizePhone(agenteWhatsapp.telefone);
        console.log(`✅ [${requestId}] Agente Pri - Whatsapp encontrado para evento de Ligação:`);
        console.log(`   ├─ Nome: ${agenteWhatsapp.nome}`);
        console.log(`   └─ Telefone: ${telefonePriWhatsapp}`);
      } else {
        console.warn(`⚠️ [${requestId}] Agente Pri - Whatsapp NÃO encontrado para evento de Ligação`);
      }
    }

    // Determinar webhook - IA Ligação usa dispara-ligacao, IA Whatsapp usa recebe-leads-pri
    const webhookUrl = isIALigacao 
      ? 'https://automatemaiawh.sagadatadriven.com.br/webhook/dispara-ligacao'
      : 'https://automatemaiawh.sagadatadriven.com.br/webhook/recebe-leads-pri';

    console.log(`\n🌐 [${requestId}] Webhook URL: ${webhookUrl}`);

    // Para IA Ligação, o disparo é feito em batch com id_evento e telefone_pri apenas
    // O evento e a base já foram criados anteriormente pelos webhooks cria-evento-ligacao e cria-base-ligacao
    const eventIdPri = prospeccao_data?.event_id_pri || '';

    // Dados comuns para leads WhatsApp
    const dadosComuns = {
      prospeccao_id,
      evento_nome: prospeccao_data?.titulo || '',
      event_id_pri: eventIdPri,
      data_inicio: prospeccao_data?.data_inicio || null,
      data_fim: prospeccao_data?.data_fim || null,
      canal: prospeccao_data?.canal || (isIALigacao ? 'Ligação' : 'Whatsapp'),
      telefone_pri: telefonePri,
      pri_telefone: telefonePri,
      telefone_pri_whatsapp: telefonePriWhatsapp,
      nome_agente: nomeAgente,
      dealer_id: empresaData?.crm_id || '',
      pri_dealer_id: empresaData?.crm_id || '',
      empresa_id,
      nome_empresa: empresaData?.nome_empresa || '',
      uf: empresaData?.uf || '',
      cidade: empresaData?.cidade || '',
      tipo_ia: tipoIA,
      acao: 'criar'
    };

    console.log(`\n📦 [${requestId}] Dados preparados:`);
    console.log(`   ├─ dealer_id: ${dadosComuns.dealer_id || 'N/A'}`);
    console.log(`   ├─ telefone_pri: ${dadosComuns.telefone_pri || 'N/A'}`);
    console.log(`   ├─ telefone_pri_whatsapp: ${dadosComuns.telefone_pri_whatsapp || 'N/A'}`);
    console.log(`   ├─ nome_agente: ${dadosComuns.nome_agente || 'N/A'}`);
    console.log(`   └─ event_id_pri: ${eventIdPri || 'N/A'}`);

    // PARA IA LIGAÇÃO: Enviar todos os leads em UMA ÚNICA chamada ao webhook
    // Formato SEMPRE usa array contatos, seja 1 ou múltiplos leads
    if (isIALigacao) {
      console.log(`\n📞 [${requestId}] Disparo Ligação - Enviando ${leads.length} lead(s) em uma única chamada`);
      
      // Preparar array de contatos para o webhook - SEMPRE como array
      const contatosArray = leads.map(lead => ({
        telefone_lead: normalizePhone(lead.telefone),
        nome: lead.nome,
      }));

      // Payload único contendo todos os contatos - SEMPRE usa formato array
      const payloadLigacao = {
        id_evento: eventIdPri,
        telefone_pri: telefonePri,
        loja: empresaData?.nome_empresa || '',
        contatos: contatosArray
      };

      console.log(`   ├─ id_evento: ${eventIdPri}`);
      console.log(`   ├─ telefone_pri: ${telefonePri}`);
      console.log(`   ├─ loja: ${empresaData?.nome_empresa || ''}`);
      console.log(`   └─ contatos: ${leads.length} lead(s)`);
      contatosArray.slice(0, 5).forEach((c, i) => {
        console.log(`      ${i === Math.min(4, contatosArray.length - 1) ? '└' : '├'}─ ${c.nome} (${c.telefone_lead})`);
      });
      if (contatosArray.length > 5) {
        console.log(`      ... e mais ${contatosArray.length - 5} contatos`);
      }

      try {
        const fetchStartTime = Date.now();
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadLigacao)
        });
        
        const fetchDuration = Date.now() - fetchStartTime;
        
        let responseBody = '';
        try {
          responseBody = await response.text();
        } catch (e) {
          responseBody = '[Não foi possível ler resposta]';
        }
        
        const dataDisparoIA = new Date().toISOString();
        
        if (response.ok) {
          console.log(`\n✅ [${requestId}] Webhook Ligação ENVIADO com sucesso - Status: ${response.status} - Tempo: ${fetchDuration}ms`);
          console.log(`   └─ Resposta: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`);
          
          // Atualizar todos os leads como disparados
          const leadIds = leads.map(l => l.id);
          const { error: updateError } = await supabase
            .from('contatos')
            .update({ data_disparo_ia: dataDisparoIA })
            .in('id', leadIds);
          
          if (updateError) {
            console.error(`❌ [${requestId}] Erro ao atualizar banco:`, updateError);
          } else {
            console.log(`💾 [${requestId}] ${leadIds.length} leads atualizados no banco`);
          }

          const totalDuration = Date.now() - startTime;
          
          return new Response(
            JSON.stringify({ 
              success: true,
              request_id: requestId,
              tipo_ia: tipoIA,
              webhook_url: webhookUrl,
              estatisticas: {
                total: leads.length,
                sucessos: leads.length,
                falhas: 0,
                tempo_ms: totalDuration
              },
              resultados: leads.map(l => ({ lead_id: l.id, nome: l.nome, success: true })),
              mensagem: `${leads.length} leads enviados com sucesso para ${tipoIA}`
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error(`\n❌ [${requestId}] Webhook Ligação FALHOU - Status: ${response.status} - Tempo: ${fetchDuration}ms`);
          console.error(`   └─ Resposta: ${responseBody.substring(0, 300)}${responseBody.length > 300 ? '...' : ''}`);
          
          return new Response(
            JSON.stringify({ 
              success: false,
              request_id: requestId,
              tipo_ia: tipoIA,
              error: `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
              estatisticas: {
                total: leads.length,
                sucessos: 0,
                falhas: leads.length,
                tempo_ms: Date.now() - startTime
              }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (err: any) {
        console.error(`\n❌ [${requestId}] Erro de rede ao chamar webhook Ligação:`, err.message);
        
        return new Response(
          JSON.stringify({ 
            success: false,
            request_id: requestId,
            tipo_ia: tipoIA,
            error: err.message,
            estatisticas: {
              total: leads.length,
              sucessos: 0,
              falhas: leads.length,
              tempo_ms: Date.now() - startTime
            }
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // PARA IA WHATSAPP: Processar leads em batches (mantém comportamento anterior)
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(leads.length / BATCH_SIZE);
    const resultados: { lead_id: string; nome: string; success: boolean; status?: number; error?: string }[] = [];
    const dataDisparoIA = new Date().toISOString();
    let totalAtualizadosNoBanco = 0;
    
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📤 [${requestId}] Iniciando envio de ${leads.length} leads em ${totalBatches} batches`);
    console.log(`${'─'.repeat(60)}`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batch = leads.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNum = batchIndex + 1;
      
      console.log(`\n📦 [${requestId}] BATCH ${batchNum}/${totalBatches} - Processando ${batch.length} leads (${batchStart + 1} a ${batchStart + batch.length})`);
      
      const batchStartTime = Date.now();
      const batchResultados: { lead_id: string; nome: string; success: boolean; status?: number; error?: string }[] = [];
      
      const promessas = batch.map(async (lead, leadIndex) => {
        // Payload para IA Whatsapp
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
          tipo_importacao: 'planilha'
        };

        const leadNum = batchStart + leadIndex + 1;
        console.log(`   [${requestId}] Lead #${leadNum}: ${lead.nome} (Tel: ${normalizePhone(lead.telefone) || 'N/A'})`);
        
        try {
          const fetchStartTime = Date.now();
          
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          const fetchDuration = Date.now() - fetchStartTime;
          
          // Tentar ler resposta do webhook
          let responseBody = '';
          try {
            responseBody = await response.text();
          } catch (e) {
            responseBody = '[Não foi possível ler resposta]';
          }
          
          if (response.ok) {
            console.log(`   ✅ [${requestId}] Lead #${leadNum} ENVIADO - Status: ${response.status} - Tempo: ${fetchDuration}ms`);
            console.log(`      └─ Resposta: ${responseBody.substring(0, 100)}${responseBody.length > 100 ? '...' : ''}`);
            batchResultados.push({ 
              lead_id: lead.id, 
              nome: lead.nome, 
              success: true, 
              status: response.status 
            });
          } else {
            console.error(`   ❌ [${requestId}] Lead #${leadNum} FALHOU - Status: ${response.status} - Tempo: ${fetchDuration}ms`);
            console.error(`      └─ Resposta: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`);
            batchResultados.push({ 
              lead_id: lead.id, 
              nome: lead.nome, 
              success: false, 
              status: response.status,
              error: `HTTP ${response.status}: ${responseBody.substring(0, 100)}`
            });
          }
        } catch (err: any) {
          console.error(`   ❌ [${requestId}] Lead #${leadNum} ERRO DE REDE:`, err.message);
          batchResultados.push({ 
            lead_id: lead.id, 
            nome: lead.nome, 
            success: false, 
            error: err.message 
          });
        }
      });

      await Promise.all(promessas);
      
      // ATUALIZAR data_disparo_ia IMEDIATAMENTE após cada batch
      const leadsComSucessoBatch = batchResultados.filter(r => r.success).map(r => r.lead_id);
      if (leadsComSucessoBatch.length > 0) {
        const { error: updateError } = await supabase
          .from('contatos')
          .update({ data_disparo_ia: dataDisparoIA })
          .in('id', leadsComSucessoBatch);
        
        if (updateError) {
          console.error(`   ❌ [${requestId}] Erro ao atualizar banco no batch ${batchNum}:`, updateError);
        } else {
          totalAtualizadosNoBanco += leadsComSucessoBatch.length;
          console.log(`   💾 [${requestId}] Batch ${batchNum}: ${leadsComSucessoBatch.length} leads atualizados no banco (total: ${totalAtualizadosNoBanco})`);
        }
      }
      
      // Adicionar resultados do batch ao total
      resultados.push(...batchResultados);
      
      const batchDuration = Date.now() - batchStartTime;
      console.log(`   ⏱️ [${requestId}] Batch ${batchNum} concluído em ${batchDuration}ms`);
    }

    // Estatísticas finais
    const totalDuration = Date.now() - startTime;
    const sucessos = resultados.filter(r => r.success).length;
    const falhas = resultados.filter(r => !r.success).length;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 [${requestId}] RESUMO FINAL DO PROCESSAMENTO`);
    console.log(`${'='.repeat(80)}`);
    console.log(`   ├─ Total de leads: ${leads.length}`);
    console.log(`   ├─ Sucessos: ${sucessos} (${((sucessos/leads.length)*100).toFixed(1)}%)`);
    console.log(`   ├─ Falhas: ${falhas} (${((falhas/leads.length)*100).toFixed(1)}%)`);
    console.log(`   ├─ Atualizados no banco: ${totalAtualizadosNoBanco}`);
    console.log(`   ├─ Tempo total: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
    console.log(`   ├─ Média por lead: ${(totalDuration/leads.length).toFixed(1)}ms`);
    console.log(`   └─ Webhook: ${webhookUrl}`);
    console.log(`${'='.repeat(80)}\n`);

    // Listar falhas se houver
    if (falhas > 0) {
      console.log(`\n⚠️ [${requestId}] LEADS COM FALHA:`);
      resultados.filter(r => !r.success).forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.nome} (${r.lead_id}): ${r.error}`);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        request_id: requestId,
        tipo_ia: tipoIA,
        webhook_url: webhookUrl,
        estatisticas: {
          total: leads.length,
          sucessos,
          falhas,
          tempo_ms: totalDuration
        },
        resultados: resultados.slice(0, 10), // Primeiros 10 para não sobrecarregar
        mensagem: `${sucessos}/${leads.length} leads enviados com sucesso para ${tipoIA}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`\n❌ [${requestId}] ERRO CRÍTICO:`, error);
    console.error(`   Stack:`, error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        request_id: requestId,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
