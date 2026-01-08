import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/configura-eventos-saga-one';

interface EventoData {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  canal: string;
  empresa_id: string;
  evento_principal: boolean;
  qualificar_lead: boolean;
  imagem_divulgacao_url: string | null;
}

interface ContatoData {
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
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
    const { evento, contatos, empresa_id } = body;

    console.log('📞 IA Ligação Webhook - Enviando evento + contatos');
    console.log('📞 Evento:', evento?.titulo);
    console.log('📞 Total contatos:', contatos?.length || 0);

    // Buscar dados da empresa
    const { data: empresaData } = await supabase
      .from('empresas')
      .select('crm_id, nome_empresa, cnpj')
      .eq('id', empresa_id)
      .single();

    // Buscar dados do agente IA da empresa
    const { data: agenteData } = await supabase
      .from('agentes_ia')
      .select('telefone, dealer_id, nome')
      .eq('empresa_id', empresa_id)
      .eq('ativo', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

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

    // Payload combinado com evento + contatos
    const payload = {
      evento: {
        id: evento.id,
        titulo: evento.titulo || '',
        descricao: evento.descricao || '',
        data_inicio: formatarDataISO(evento.data_inicio),
        data_fim: formatarDataISO(evento.data_fim),
        canal: evento.canal || 'Ligação',
        evento_principal: evento.evento_principal ?? false,
        qualificar_lead: evento.qualificar_lead ?? true,
        imagem_divulgacao_url: evento.imagem_divulgacao_url || '',
      },
      empresa: {
        id: empresa_id,
        nome: empresaData?.nome_empresa || '',
        cnpj: empresaData?.cnpj || '',
        crm_id: empresaData?.crm_id || '',
      },
      agente: {
        telefone: agenteData?.telefone || '',
        dealer_id: agenteData?.dealer_id || '',
        nome: agenteData?.nome || '',
      },
      contatos: (contatos || []).map((c: ContatoData) => ({
        nome: c.nome || '',
        telefone: c.telefone || '',
        email: c.email || '',
        origem: c.origem || 'IA Ligação',
      })),
      total_contatos: contatos?.length || 0,
      timestamp: new Date().toISOString(),
    };

    console.log('📤 Enviando para:', WEBHOOK_URL);
    console.log('📦 Payload:', JSON.stringify({
      ...payload,
      contatos: `[${payload.total_contatos} contatos]`
    }, null, 2));

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
