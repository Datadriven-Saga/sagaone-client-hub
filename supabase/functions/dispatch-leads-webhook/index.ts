import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para apenas dígitos
const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  // Remover prefixo 55 se o número tiver mais de 11 dígitos
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.substring(2);
  }
  return digits;
};

// Normaliza telefone para formato de discador: DDD + 8 dígitos (remove 9º dígito de celular)
const normalizePhoneForDialer = (phone: string | null): string => {
  let digits = normalizePhone(phone);
  // Se tem 11 dígitos (DDD + 9 + 8 dígitos), remove o 9 extra
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.substring(0, 2) + digits.substring(3);
  }
  return digits;
};

interface Lead {
  id: string;
  lead_id: number | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: string | null;
  origem: string | null;
  vendedor_nome?: string | null;
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
    template_prospeccao_id: string | null; // UUID do template
  };
}

// Função para resolver variáveis do template com valores reais do lead
function resolveVariableMapping(
  mapping: Record<string, string> | null,
  lead: Lead,
  empresa: { nome_empresa: string; marca?: string; uf?: string; cidade?: string } | null,
  prospeccaoData: { titulo?: string; data_inicio?: string | null; data_fim?: string | null } | null
): Record<string, string> | null {
  if (!mapping || Object.keys(mapping).length === 0) return null;
  
  const resolved: Record<string, string> = {};
  
  for (const [position, fieldName] of Object.entries(mapping)) {
    let value = '';
    
    switch (fieldName) {
      case 'nome_cliente':
        value = lead.nome || '';
        break;
      case 'empresa':
        value = empresa?.nome_empresa || '';
        break;
      case 'marca':
        value = empresa?.marca || empresa?.nome_empresa || '';
        break;
      case 'telefone':
        value = lead.telefone || '';
        break;
      case 'data_atual':
        value = new Date().toLocaleDateString('pt-BR');
        break;
      case 'nome_prospeccao':
        value = prospeccaoData?.titulo || '';
        break;
      case 'data_inicio':
        value = prospeccaoData?.data_inicio 
          ? new Date(prospeccaoData.data_inicio).toLocaleDateString('pt-BR') 
          : '';
        break;
      case 'data_fim':
        value = prospeccaoData?.data_fim 
          ? new Date(prospeccaoData.data_fim).toLocaleDateString('pt-BR') 
          : '';
        break;
      case 'vendedor_nome':
        value = lead.vendedor_nome || '';
        break;
      case 'uf':
        value = empresa?.uf || '';
        break;
      case 'cidade':
        value = empresa?.cidade || '';
        break;
      default:
        // Se não reconhecer o campo, mantém o nome do campo como fallback
        value = fieldName;
    }
    
    resolved[position] = value;
  }
  
  return Object.keys(resolved).length > 0 ? resolved : null;
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

    // Obter token de autenticação
    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';

    // Para IA Ligação, o disparo é feito em batch com id_evento e telefone_pri apenas
    // O evento e a base já foram criados anteriormente pelos webhooks cria-evento-ligacao e cria-base-ligacao
    const eventIdPri = prospeccao_data?.event_id_pri || '';

    // Buscar template WhatsApp associado à prospecção para obter variable_mapping
    let variableMapping: Record<string, any> | null = null;
    let temVariavel = 'Não';
    let templateNome = '';
    
    if (!isIALigacao) {
      const templateId = prospeccao_data?.template_prospeccao_id;
      console.log(`\n📝 [${requestId}] Buscando template WhatsApp...`);
      console.log(`   ├─ Template ID do evento: ${templateId || 'N/A'}`);
      
      if (!templateId) {
        // Sem template configurado - não pode disparar
        console.error(`❌ [${requestId}] Evento não possui template de prospecção configurado`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Evento não possui template de prospecção configurado. Configure um template antes de disparar.',
            request_id: requestId 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Buscar template pelo ID (UUID)
      const { data: templateData, error: templateError } = await supabase
        .from('whatsapp_templates')
        .select('variable_mapping, conteudo, nome')
        .eq('id', templateId)
        .eq('ativo', true)
        .maybeSingle();

      if (templateError) {
        console.warn(`⚠️ [${requestId}] Erro ao buscar template:`, templateError);
      } else if (templateData) {
        variableMapping = templateData.variable_mapping as Record<string, any> | null;
        templateNome = templateData.nome;
        // Verificar se tem variáveis no conteúdo
        const hasVars = /\{\{\d+\}\}/.test(templateData.conteudo || '');
        temVariavel = hasVars ? 'Sim' : 'Não';
        console.log(`   ├─ Template encontrado: ${templateData.nome}`);
        console.log(`   ├─ Variable mapping:`, variableMapping ? JSON.stringify(variableMapping) : 'Não definido');
        console.log(`   └─ tem_variavel: ${temVariavel}`);
      } else {
        console.error(`❌ [${requestId}] Template com ID ${templateId} não encontrado ou inativo`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Template configurado não encontrado ou está inativo. Verifique a configuração do evento.`,
            request_id: requestId 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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
      acao: 'criar',
      tem_variavel: temVariavel,
      variable_mapping: variableMapping,
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
        
        // Timeout de 30s para evitar travamento
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        console.log(`📡 [${requestId}] Enviando payload ao webhook: ${JSON.stringify(payloadLigacao).substring(0, 500)}`);
        
        let response: Response;
        try {
          response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
            },
            body: JSON.stringify(payloadLigacao),
            signal: controller.signal,
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          const isTimeout = fetchErr.name === 'AbortError';
          console.error(`❌ [${requestId}] Fetch falhou (${isTimeout ? 'TIMEOUT 30s' : fetchErr.message})`);
          throw new Error(isTimeout ? 'Timeout de 30s ao chamar webhook externo' : fetchErr.message);
        }
        clearTimeout(timeoutId);
        
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
          
          // Atualizar contatos (global)
          const { error: updateError } = await supabase
            .from('contatos')
            .update({ data_disparo_ia: dataDisparoIA })
            .in('id', leadIds);
          
          if (updateError) {
            console.error(`❌ [${requestId}] Erro ao atualizar contatos:`, updateError);
          } else {
            console.log(`💾 [${requestId}] ${leadIds.length} contatos atualizados`);
          }
          
          // Atualizar eventos_prospeccao (por evento) - CRÍTICO para métricas
          const { error: eventosUpdateError } = await supabase
            .from('eventos_prospeccao')
            .update({ data_disparo_ia: dataDisparoIA })
            .eq('prospeccao_id', prospeccao_id)
            .in('contato_id', leadIds);
          
          if (eventosUpdateError) {
            console.error(`❌ [${requestId}] Erro ao atualizar eventos_prospeccao:`, eventosUpdateError);
          } else {
            console.log(`💾 [${requestId}] eventos_prospeccao atualizados para prospecção ${prospeccao_id}`);
          }

          // =====================================================
          // BACKUP: Salvar na tabela cadencia_pri_voz
          // =====================================================
          try {
            console.log(`💾 [${requestId}] Salvando backup em cadencia_pri_voz...`);
            
            const cadenciasBackup = leads.map(lead => ({
              telefone_lead: normalizePhone(lead.telefone),
              telefone_pri: telefonePri,
              id_evento: parseInt(eventIdPri, 10),
              num_tentativas: 1,
              hora_primeira_tentativa: dataDisparoIA,
              hora_ultima_tentativa: dataDisparoIA,
              empresa_id: empresa_id,
              criado_em: dataDisparoIA,
              atualizado_em: dataDisparoIA,
            }));

            if (cadenciasBackup.length > 0) {
              // Fazer upsert em lotes de 100
              const batchSize = 100;
              for (let i = 0; i < cadenciasBackup.length; i += batchSize) {
                const batch = cadenciasBackup.slice(i, i + batchSize);
                const { error: upsertError } = await supabase
                  .from('cadencia_pri_voz')
                  .upsert(batch, { onConflict: 'telefone_lead,id_evento' });

                if (upsertError) {
                  console.error(`⚠️ [${requestId}] Erro no batch ${i / batchSize + 1} de cadencia_pri_voz:`, upsertError);
                }
              }
              console.log(`✅ [${requestId}] Backup de ${cadenciasBackup.length} cadências salvo`);
            }
          } catch (backupError: any) {
            console.error(`⚠️ [${requestId}] Erro no backup cadencia_pri_voz (não crítico):`, backupError);
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
        // Resolver variable_mapping para este lead específico com valores reais
        const resolvedVariableMapping = resolveVariableMapping(
          variableMapping as Record<string, string> | null,
          lead,
          empresaData,
          prospeccao_data
        );

        // Log do primeiro lead para debug do variable_mapping
        if (batchIndex === 0 && leadIndex === 0) {
          console.log(`\n📝 [${requestId}] Variable mapping resolvido (amostra 1º lead):`);
          console.log(`   ├─ Original:`, variableMapping ? JSON.stringify(variableMapping) : 'null');
          console.log(`   └─ Resolvido:`, resolvedVariableMapping ? JSON.stringify(resolvedVariableMapping) : 'null');
        }

        // Payload para IA Whatsapp - com variable_mapping resolvido
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
          // Substituir o mapping original pelo resolvido com valores reais
          variable_mapping: resolvedVariableMapping,
        };

        const leadNum = batchStart + leadIndex + 1;
        console.log(`   [${requestId}] Lead #${leadNum}: ${lead.nome} (Tel: ${normalizePhone(lead.telefone) || 'N/A'})`);
        
        try {
          const fetchStartTime = Date.now();
          
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
            },
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
        // Atualizar contatos (global)
        const { error: updateError } = await supabase
          .from('contatos')
          .update({ data_disparo_ia: dataDisparoIA })
          .in('id', leadsComSucessoBatch);
        
        if (updateError) {
          console.error(`   ❌ [${requestId}] Erro ao atualizar contatos no batch ${batchNum}:`, updateError);
        } else {
          totalAtualizadosNoBanco += leadsComSucessoBatch.length;
          console.log(`   💾 [${requestId}] Batch ${batchNum}: ${leadsComSucessoBatch.length} contatos atualizados (total: ${totalAtualizadosNoBanco})`);
        }
        
        // Atualizar eventos_prospeccao (por evento) - CRÍTICO para métricas
        const { error: eventosUpdateError } = await supabase
          .from('eventos_prospeccao')
          .update({ data_disparo_ia: dataDisparoIA })
          .eq('prospeccao_id', prospeccao_id)
          .in('contato_id', leadsComSucessoBatch);
        
        if (eventosUpdateError) {
          console.error(`   ❌ [${requestId}] Erro ao atualizar eventos_prospeccao no batch ${batchNum}:`, eventosUpdateError);
        } else {
          console.log(`   💾 [${requestId}] Batch ${batchNum}: eventos_prospeccao atualizados`);
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
