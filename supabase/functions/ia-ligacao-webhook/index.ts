import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhooks para diferentes operações
const WEBHOOK_CRIAR = 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-evento-ligacao';
const WEBHOOK_ATUALIZAR = 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-evento-ligacao';
const WEBHOOK_DELETAR = 'https://automatemaiawh.sagadatadriven.com.br/webhook/deleta-eventos-saga-one';
const WEBHOOK_VERIFICA = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos';
const VERIFICA_EVENTOS_ID_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica_eventos_id';

interface EventoInput {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  canal: string;
  evento_principal: boolean;
  qualificar_lead: boolean;
  imagem_divulgacao_url: string | null;
  uf: string | null;
  cidade: string | null;
  endereco: string | null;
  id_evento?: number;
}

interface ContatoInput {
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
}

interface EmpresaData {
  id: string;
  nome_empresa: string;
  cnpj: string;
  crm_id: string | null;
  uf: string | null;
  marca: string | null;
  cidade: string | null;
  endereco: string | null;
}

// Busca o próximo id_evento via webhook externo + banco local (para evitar colisão)
async function buscarProximoIdEvento(supabase: any): Promise<number> {
  const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
  
  // Buscar em paralelo: webhook externo + banco local
  const [webhookResult, dbResult] = await Promise.allSettled([
    (async () => {
      console.log('🔍 Consultando webhook verifica-eventos...');
      const response = await fetch(WEBHOOK_VERIFICA, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Webhook retornou status ${response.status}: ${text}`);
      }
      return await response.json();
    })(),
    supabase
      .from('prospeccoes')
      .select('event_id_pri')
      .eq('canal', 'Ligação')
      .not('event_id_pri', 'is', null),
  ]);

  const usedIds = new Set<number>();
  let maxId = 0;

  // Processar resultado do webhook
  if (webhookResult.status === 'fulfilled') {
    const data = webhookResult.value;
    console.log('📊 Resposta verifica-eventos:', JSON.stringify(data));
    
    const extractIds = (payload: any) => {
      if (typeof payload === 'number') { usedIds.add(payload); if (payload > maxId) maxId = payload; return; }
      if (Array.isArray(payload)) {
        for (const item of payload) {
          const n = parseInt(String(item?.id_evento ?? item?.id ?? ''), 10);
          if (!isNaN(n)) { usedIds.add(n); if (n > maxId) maxId = n; }
        }
        return;
      }
      if (payload && typeof payload === 'object') {
        for (const key of ['eventos', 'data']) {
          if (Array.isArray(payload[key])) { extractIds(payload[key]); return; }
        }
        for (const key of ['id_evento', 'last_id', 'ultimo_id', 'proximo_id']) {
          const n = parseInt(String(payload[key] ?? ''), 10);
          if (!isNaN(n)) { usedIds.add(n); if (n > maxId) maxId = n; }
        }
      }
    };
    extractIds(data);
  } else {
    console.error('⚠️ Webhook verifica-eventos falhou:', webhookResult.reason);
  }

  // Processar resultado do banco local
  if (dbResult.status === 'fulfilled' && !dbResult.value.error) {
    for (const row of dbResult.value.data ?? []) {
      const n = parseInt(String(row.event_id_pri ?? ''), 10);
      if (!isNaN(n)) { usedIds.add(n); if (n > maxId) maxId = n; }
    }
  } else {
    console.error('⚠️ Consulta banco local falhou:', dbResult.status === 'rejected' ? dbResult.reason : dbResult.value?.error);
  }

  // Também buscar IDs da tabela eventos_pri_voz
  const { data: evtPriVoz } = await supabase
    .from('eventos_pri_voz')
    .select('id_evento');
  
  for (const row of evtPriVoz ?? []) {
    const n = parseInt(String(row.id_evento ?? ''), 10);
    if (!isNaN(n)) { usedIds.add(n); if (n > maxId) maxId = n; }
  }

  let candidato = maxId + 1;
  while (usedIds.has(candidato)) candidato++;

  console.log('🔢 Próximo ID calculado:', candidato, '| Total IDs conhecidos:', usedIds.size, '| Max:', maxId);
  return candidato;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { evento, contatos, empresa_id, acao, agente_template } = body as {
      evento: EventoInput;
      contatos?: ContatoInput[];
      empresa_id: string;
      acao?: 'criar' | 'atualizar' | 'deletar' | 'ativar' | 'desativar';
      agente_template?: { telefone: string; dealer_id: string; nome: string } | null;
    };

    const operacao = acao === 'ativar' || acao === 'desativar' ? 'atualizar' : (acao || 'criar');
    const statusEvento = acao === 'desativar' ? 'inativo' : 'ativo';

    console.log('📞 IA Ligação Webhook - Operação:', operacao);
    console.log('📞 Evento:', evento?.titulo);
    console.log('📞 Total contatos:', contatos?.length || 0);
    console.log('📞 Agente do template recebido:', agente_template);

    // Buscar dados completos da empresa
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas')
      .select('id, nome_empresa, cnpj, crm_id, uf, marca, cidade, endereco')
      .eq('id', empresa_id)
      .single();

    if (empresaError) {
      console.error('❌ Erro ao buscar empresa:', empresaError);
    }

    const empresa = empresaData as EmpresaData | null;

    // Dealer ID SEMPRE vem do crm_id da empresa (OBRIGATÓRIO)
    const dealerId = (empresa?.crm_id || '').trim();
    if (!dealerId) {
      console.error('❌ crm_id da empresa está vazio:', empresa_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'crm_id da loja não configurado. Preencha o crm_id da empresa antes de criar/atualizar o evento.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar DOIS agentes: Pri(Ligação) e Pri - WhatsApp
    let telefonePriLigacao = '';
    let telefonePriWhatsapp = '';

    const { data: agentesVinculados, error: agentesVinculadosErr } = await supabase
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

    if (agentesVinculadosErr) {
      console.error('⚠️ Erro ao buscar agente_empresas:', agentesVinculadosErr);
    }

    const agentes = (agentesVinculados || [])
      .map((ae: any) => ae.agentes_ia)
      .filter((a: any) => a && a.ativo)
      .filter((a: any, idx: number, self: any[]) => idx === self.findIndex(t => t?.id === a?.id));

    console.log('📋 Agentes vinculados:', agentes.map((a: any) => ({ nome: a?.nome, telefone: a?.telefone })));

    // Buscar Pri(Ligação)
    const searchPatternsLigacao = ['pri(ligação)', 'pri(ligacao)', 'pri - ligação', 'pri - ligacao', 'pri ligação', 'pri ligacao'];
    const agentePriLigacao = agentes.find((a: any) => {
      const nome = String(a?.nome || '').toLowerCase();
      return searchPatternsLigacao.some(pattern => nome.includes(pattern)) && a?.telefone;
    });

    if (agentePriLigacao?.telefone) {
      telefonePriLigacao = agentePriLigacao.telefone.replace(/\D/g, '');
      console.log('✅ Agente Pri(Ligação):', agentePriLigacao.nome, '| Tel:', telefonePriLigacao);
    }

    // Buscar Pri - WhatsApp
    const searchPatternsWhatsapp = ['pri - whatsapp', 'pri whatsapp', 'pri-whatsapp'];
    const agentePriWhatsapp = agentes.find((a: any) => {
      const nome = String(a?.nome || '').toLowerCase();
      return searchPatternsWhatsapp.some(pattern => nome.includes(pattern)) && a?.telefone;
    });

    if (agentePriWhatsapp?.telefone) {
      telefonePriWhatsapp = agentePriWhatsapp.telefone.replace(/\D/g, '');
      console.log('✅ Agente Pri - WhatsApp:', agentePriWhatsapp.nome, '| Tel:', telefonePriWhatsapp);
    }

    // Fallback: usar agente_template do frontend se não achou no banco
    if (!telefonePriLigacao && agente_template?.telefone) {
      telefonePriLigacao = agente_template.telefone.replace(/\D/g, '');
      console.log('⚠️ Usando telefone Pri(Ligação) do frontend (fallback):', telefonePriLigacao);
    }

    // Validar: Pri(Ligação) é obrigatório
    if (!telefonePriLigacao) {
      console.error('❌ Telefone Pri(Ligação) não encontrado:', empresa_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Agente "Pri(Ligação)" não encontrado (ou sem telefone). Configure o agente na loja antes de criar/atualizar o evento.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📱 Pri(Ligação):', telefonePriLigacao, '| Pri WhatsApp:', telefonePriWhatsapp || '(N/A)', '| Dealer:', dealerId);

    const formatarDataISO = (data: string | null): string => {
      if (!data) return '';
      try {
        if (data.includes('T')) return new Date(data).toISOString();
        return new Date(data + 'T11:00:00.000Z').toISOString();
      } catch { return ''; }
    };

    const now = new Date().toISOString();

    // =====================================================
    // GERAR OU USAR id_evento NUMÉRICO
    // =====================================================
    let idEvento: number | undefined = evento.id_evento;
    
    if (operacao === 'criar' && !idEvento) {
      console.log('⚠️ ID do evento não fornecido pelo frontend, calculando...');
      idEvento = await buscarProximoIdEvento(supabase);
      console.log('🔢 ID Evento calculado (fallback):', idEvento);
    } else if (operacao === 'criar' && idEvento) {
      // Validar que o ID fornecido pelo frontend não foi usado entre o cálculo e agora
      const { data: conflictCheck } = await supabase
        .from('eventos_pri_voz')
        .select('id_evento')
        .eq('id_evento', idEvento)
        .maybeSingle();
      
      if (conflictCheck) {
        console.warn(`⚠️ ID ${idEvento} já existe em eventos_pri_voz, recalculando...`);
        idEvento = await buscarProximoIdEvento(supabase);
        console.log('🔢 ID Evento recalculado:', idEvento);
      } else {
        console.log('✅ ID Evento recebido do frontend (validado):', idEvento);
      }
    }
    
    // Para atualização/exclusão, buscar o ID existente se não fornecido
    if ((operacao === 'atualizar' || operacao === 'deletar') && !idEvento && evento.id) {
      const { data: prospData } = await supabase
        .from('prospeccoes')
        .select('event_id_pri')
        .eq('id', evento.id)
        .single();
      
      if (prospData?.event_id_pri) {
        idEvento = parseInt(prospData.event_id_pri, 10);
        if (isNaN(idEvento)) idEvento = undefined;
        console.log('🔢 ID Evento existente:', idEvento);
      }
    }

    // VALIDAÇÃO CRÍTICA: id_evento é obrigatório para criar
    if (operacao === 'criar' && !idEvento) {
      console.error('❌ Não foi possível determinar um id_evento para criação');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não foi possível gerar um ID único para o evento. Tente novamente.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // PERSISTIR LOCALMENTE PRIMEIRO (eventos_pri_voz)
    // =====================================================
    const backupData = {
      id_evento: idEvento!,
      nome: evento.titulo || '',
      descricao: evento.descricao || null,
      categoria: 'evento',
      marca: empresa?.marca || empresa?.nome_empresa || '',
      dealerid: dealerId,
      telefone_pri: telefonePriLigacao,
      telefone_pri_whatsapp: telefonePriWhatsapp || null,
      uf: evento.uf || empresa?.uf || null,
      cidade: evento.cidade || empresa?.cidade || null,
      endereco: evento.endereco || empresa?.endereco || null,
      data_inicio: evento.data_inicio ? formatarDataISO(evento.data_inicio) : null,
      data_fim: evento.data_fim ? formatarDataISO(evento.data_fim) : null,
      evt_status: statusEvento,
      empresa_id: empresa_id,
      atualizado_em: now,
    };

    if (operacao === 'criar') {
      const { error: insertError } = await supabase
        .from('eventos_pri_voz')
        .insert({ ...backupData, criado_em: now });

      if (insertError) {
        console.error('⚠️ Erro ao inserir eventos_pri_voz:', insertError);
        // Se é conflito de id_evento, tentar upsert
        if (insertError.code === '23505') {
          const { error: upsertError } = await supabase
            .from('eventos_pri_voz')
            .upsert(backupData, { onConflict: 'id_evento' });
          if (upsertError) console.error('⚠️ Erro no upsert eventos_pri_voz:', upsertError);
          else console.log('✅ Backup salvo via upsert em eventos_pri_voz');
        }
      } else {
        console.log('✅ Backup criado em eventos_pri_voz');
      }
    } else if (operacao === 'atualizar') {
      const { error: upsertError } = await supabase
        .from('eventos_pri_voz')
        .upsert(backupData, { onConflict: 'id_evento' });

      if (upsertError) console.error('⚠️ Erro ao atualizar eventos_pri_voz:', upsertError);
      else console.log('✅ Backup atualizado em eventos_pri_voz');
    }

    // =====================================================
    // ENVIAR PARA WEBHOOK EXTERNO
    // =====================================================
    const eventoPayload = {
      id_evento: idEvento,
      nome: evento.titulo || '',
      descricao: evento.descricao || '',
      categoria: 'evento',
      marca: empresa?.marca || empresa?.nome_empresa || '',
      dealerid: dealerId,
      telefone_pri: telefonePriLigacao,
      telefone_pri_whatsapp: telefonePriWhatsapp,
      pri_dealer_id: dealerId,
      uf: evento.uf || empresa?.uf || '',
      cidade: evento.cidade || empresa?.cidade || '',
      endereco: evento.endereco || empresa?.endereco || '',
      data_inicio: formatarDataISO(evento.data_inicio),
      data_fim: formatarDataISO(evento.data_fim),
      evt_status: statusEvento,
      criado_em: now,
      atualizado_em: now,
    };

    const payload = { evento: eventoPayload };

    let webhookUrl: string;
    switch (operacao) {
      case 'atualizar':
        webhookUrl = WEBHOOK_ATUALIZAR;
        break;
      case 'deletar':
        webhookUrl = WEBHOOK_DELETAR;
        break;
      default:
        webhookUrl = WEBHOOK_CRIAR;
    }

    console.log('📤 Enviando para:', webhookUrl);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
    const WEBHOOK_TIMEOUT = 15000; // 15 seconds timeout for external webhooks

    let responseData: unknown = null;
    let webhookOk = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log('📥 Resposta webhook:', response.status, responseText.substring(0, 500));
      webhookOk = response.ok;

      try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }
    } catch (webhookError) {
      const isTimeout = webhookError instanceof Error && webhookError.name === 'AbortError';
      console.error(`⚠️ ${isTimeout ? 'Timeout' : 'Erro'} ao chamar webhook externo (não fatal):`, webhookError);
      responseData = { 
        error: isTimeout ? 'Timeout ao comunicar com sistema externo (15s)' : 'Falha na comunicação com sistema externo', 
        detail: String(webhookError) 
      };
    }

    // =====================================================
    // CHAMAR verifica_eventos_id após criação
    // =====================================================
    if (idEvento && operacao === 'criar') {
      try {
        console.log('📡 Chamando verifica_eventos_id:', { telefone_pri: telefonePriLigacao, id_evento: idEvento });
        const verificaResponse = await fetch(VERIFICA_EVENTOS_ID_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
          },
          body: JSON.stringify({
            telefone_pri: telefonePriLigacao,
            id_evento: idEvento,
          }),
        });
        const verificaText = await verificaResponse.text();
        console.log(`✅ verifica_eventos_id (${verificaResponse.status}):`, verificaText.substring(0, 500));
      } catch (verificaError) {
        console.error('⚠️ Erro ao chamar verifica_eventos_id (não crítico):', verificaError);
      }
    }

    // SEMPRE retornar id_evento para que o frontend possa salvar
    return new Response(
      JSON.stringify({
        success: true, // O evento foi persistido localmente mesmo se o webhook externo falhou
        webhook_ok: webhookOk,
        status: webhookOk ? 200 : 502,
        url: webhookUrl,
        data: responseData,
        id_evento: idEvento,
        acao: operacao,
        payload_enviado: payload,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no IA Ligação Webhook:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});