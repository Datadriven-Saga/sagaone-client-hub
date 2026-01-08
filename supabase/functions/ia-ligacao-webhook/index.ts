import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/configura-eventos-saga-one';

// Telefone padrão da Pri (fallback caso não encontre no banco)
const TELEFONE_PRI_DEFAULT = '6223980043';

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
  // Localização específica do evento
  uf: string | null;
  cidade: string | null;
  endereco: string | null;
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

interface AgenteData {
  telefone: string | null;
  dealer_id: string | null;
  nome: string;
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
    const { evento, contatos, empresa_id } = body as {
      evento: EventoInput;
      contatos: ContatoInput[];
      empresa_id: string;
    };

    console.log('📞 IA Ligação Webhook - Enviando evento + contatos');
    console.log('📞 Evento:', evento?.titulo);
    console.log('📞 Total contatos:', contatos?.length || 0);

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

    // Buscar agente "Pri" (Pri de Ligação) da empresa
    const { data: priData, error: priError } = await supabase
      .from('agentes_ia')
      .select('telefone, dealer_id, nome')
      .eq('empresa_id', empresa_id)
      .ilike('nome', '%pri%')
      .eq('ativo', true)
      .limit(1)
      .single();

    if (priError) {
      console.log('⚠️ Agente Pri não encontrado, usando fallback:', priError.message);
    }

    const agentePri = priData as AgenteData | null;

    // Se não encontrou Pri, buscar qualquer agente ativo da empresa
    let agenteBackup: AgenteData | null = null;
    if (!agentePri) {
      const { data: backupData } = await supabase
        .from('agentes_ia')
        .select('telefone, dealer_id, nome')
        .eq('empresa_id', empresa_id)
        .eq('ativo', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      agenteBackup = backupData as AgenteData | null;
    }

    // Usar dados da Pri ou fallback
    const agente = agentePri || agenteBackup;
    
    // Telefone da Pri: do agente Pri > de qualquer agente > default
    const telefonePri = agentePri?.telefone?.replace(/\D/g, '') || 
                        agenteBackup?.telefone?.replace(/\D/g, '') || 
                        TELEFONE_PRI_DEFAULT;

    // Dealer ID: do agente > crm_id da empresa
    const dealerId = agente?.dealer_id || empresa?.crm_id || '';

    const formatarDataISO = (data: string | null): string => {
      if (!data) return '';
      try {
        if (data.includes('T')) {
          return new Date(data).toISOString();
        }
        return new Date(data + 'T11:00:00.000Z').toISOString();
      } catch {
        return '';
      }
    };

    const now = new Date().toISOString();

    // Payload do evento no formato esperado pelo agente
    // Usa localização específica do evento, com fallback para dados da empresa
    const eventoPayload = {
      nome: evento.titulo || '',
      descricao: evento.descricao || '',
      categoria: 'evento', // Pode ser: evento, campanha, teste
      marca: empresa?.marca || empresa?.nome_empresa || '',
      dealerid: dealerId,
      telefone_pri: telefonePri,
      uf: evento.uf || empresa?.uf || '',
      cidade: evento.cidade || empresa?.cidade || '',
      endereco: evento.endereco || empresa?.endereco || '',
      data_inicio: formatarDataISO(evento.data_inicio),
      data_fim: formatarDataISO(evento.data_fim),
      evt_status: 'ativo',
      criado_em: now,
      atualizado_em: now,
    };

    // Payload dos contatos no formato esperado
    const contatosPayload = (contatos || []).map((c: ContatoInput) => ({
      nome: c.nome || '',
      telefone: c.telefone || '',
      loja: empresa?.nome_empresa || '', // Nome completo da loja
    }));

    // Payload completo (compatível com diferentes versões do workflow)
    // - Campos do evento no nível raiz (nome, descricao, etc.)
    // - Lista de clientes em `clientes`
    // - Mantém também `evento` e `contatos` (compat)
    const payload = {
      ...eventoPayload,
      clientes: contatosPayload,
      evento: eventoPayload,
      contatos: contatosPayload,
      total_clientes: contatosPayload.length,
      total_contatos: contatosPayload.length,
      timestamp: now,
    };

    const postWebhook = async (url: string) => {
      console.log('📤 Enviando para:', url);
      console.log('📦 Payload (preview):', JSON.stringify({
        nome: payload.nome,
        dealerid: payload.dealerid,
        telefone_pri: payload.telefone_pri,
        uf: payload.uf,
        cidade: payload.cidade,
        total_clientes: payload.total_clientes,
      }, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('✅ Resposta:', response.status, responseText);

      let responseData: unknown;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      return { ok: response.ok, status: response.status, data: responseData, url };
    };

    // Envia somente para o endpoint oficial informado
    const result = await postWebhook(WEBHOOK_URL);

    return new Response(
      JSON.stringify({
        success: result.ok,
        status: result.status,
        url: result.url,
        data: result.data,
        total_contatos: contatosPayload.length,
        payload_preview: {
          nome: payload.nome,
          dealerid: payload.dealerid,
          telefone_pri: payload.telefone_pri,
          uf: payload.uf,
          cidade: payload.cidade,
          endereco: payload.endereco,
          total_clientes: payload.total_clientes,
          cliente_exemplo: payload.clientes?.[0] ?? null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no IA Ligação Webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
