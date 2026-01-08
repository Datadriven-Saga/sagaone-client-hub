import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  convite: string | null;
}

interface ContatoData {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  status: string | null;
  observacoes: string | null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, evento, contatos, empresa_id } = body;

    console.log('📞 IA Ligação Webhook - Action:', action);
    console.log('📞 Dados recebidos:', JSON.stringify(body, null, 2));

    // Buscar dados da empresa
    const { data: empresaData } = await supabase
      .from('empresas')
      .select('crm_id, nome_empresa')
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
        // Se já é ISO, retorna direto
        if (data.includes('T')) {
          return new Date(data).toISOString();
        }
        // Se é apenas data (YYYY-MM-DD), adiciona horário
        return new Date(data + 'T11:00:00.000Z').toISOString();
      } catch {
        return '';
      }
    };

    if (action === 'configura-eventos') {
      // Enviar dados do evento para o webhook de configuração
      const eventoPayload = {
        evento_id: evento.id,
        titulo: evento.titulo || '',
        descricao: evento.descricao || '',
        data_inicio: formatarDataISO(evento.data_inicio),
        data_fim: formatarDataISO(evento.data_fim),
        canal: evento.canal || 'Ligação',
        empresa_id: empresa_id,
        empresa_nome: empresaData?.nome_empresa || '',
        dealerid: empresaData?.crm_id || '',
        maia_id: agenteData?.telefone?.replace(/\D/g, '') || '',
        maia_dealer_id: agenteData?.dealer_id || '',
        evento_principal: evento.evento_principal ?? false,
        qualificar_lead: evento.qualificar_lead ?? true,
        imagem_divulgacao_url: evento.imagem_divulgacao_url || '',
        convite: evento.convite || '',
        data_criacao: new Date().toISOString(),
      };

      console.log('📤 Enviando para configura-eventos:', JSON.stringify(eventoPayload, null, 2));

      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/configura-eventos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventoPayload),
      });

      const responseText = await response.text();
      console.log('✅ Resposta configura-eventos:', response.status, responseText);

      return new Response(
        JSON.stringify({
          success: response.ok,
          action: 'configura-eventos',
          status: response.status,
          response: responseText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'configura-base') {
      // Enviar base de contatos para o webhook
      const basePayload = {
        evento_id: evento.id,
        titulo: evento.titulo || '',
        empresa_id: empresa_id,
        empresa_nome: empresaData?.nome_empresa || '',
        dealerid: empresaData?.crm_id || '',
        maia_id: agenteData?.telefone?.replace(/\D/g, '') || '',
        maia_dealer_id: agenteData?.dealer_id || '',
        total_contatos: contatos?.length || 0,
        contatos: (contatos || []).map((c: ContatoData) => ({
          id: c.id,
          nome: c.nome || '',
          telefone: c.telefone || '',
          email: c.email || '',
          origem: c.origem || '',
          status: c.status || '',
          observacoes: c.observacoes || '',
        })),
        data_disparo: new Date().toISOString(),
      };

      console.log('📤 Enviando para configura-base:', JSON.stringify({
        ...basePayload,
        contatos: `[${basePayload.total_contatos} contatos]` // Log resumido
      }, null, 2));

      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/configura-base', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(basePayload),
      });

      const responseText = await response.text();
      console.log('✅ Resposta configura-base:', response.status, responseText);

      return new Response(
        JSON.stringify({
          success: response.ok,
          action: 'configura-base',
          status: response.status,
          response: responseText,
          total_contatos: basePayload.total_contatos,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use "configura-eventos" ou "configura-base".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no IA Ligação Webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
