import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/configura-eventos-saga-one';

// Mapeamento de telefones da Pri por UF
const TELEFONES_PRI_POR_UF: Record<string, string> = {
  'GO': '6223980043',
  // Adicionar outros estados conforme necessário
};

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

    // Buscar dados do agente IA da empresa
    const { data: agenteData, error: agenteError } = await supabase
      .from('agentes_ia')
      .select('telefone, dealer_id, nome')
      .eq('empresa_id', empresa_id)
      .eq('ativo', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (agenteError) {
      console.error('❌ Erro ao buscar agente:', agenteError);
    }

    const agente = agenteData as AgenteData | null;

    // Determinar telefone da Pri baseado na UF
    const uf = empresa?.uf || 'GO';
    const telefonePri = TELEFONES_PRI_POR_UF[uf] || TELEFONES_PRI_POR_UF['GO'];

    // Determinar dealer_id da loja
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
    const eventoPayload = {
      nome: evento.titulo || '',
      descricao: evento.descricao || '',
      categoria: 'evento', // Pode ser: evento, campanha, teste
      marca: empresa?.marca || empresa?.nome_empresa || '',
      dealerid: dealerId,
      telefone_pri: telefonePri,
      uf: empresa?.uf || '',
      cidade: empresa?.cidade || '',
      endereco: empresa?.endereco || '',
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

    // Payload completo
    const payload = {
      evento: eventoPayload,
      contatos: contatosPayload,
      total_contatos: contatosPayload.length,
      timestamp: now,
    };

    console.log('📤 Enviando para:', WEBHOOK_URL);
    console.log('📦 Payload evento:', JSON.stringify(eventoPayload, null, 2));
    console.log('📦 Total contatos:', contatosPayload.length);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('✅ Resposta:', response.status, responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data: responseData,
        total_contatos: payload.total_contatos,
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
