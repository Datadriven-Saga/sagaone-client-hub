import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminToken = Deno.env.get('SAGA_ONE_ADMIN_TOKEN');

    // Validar autenticação
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização necessário' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar se é admin token
    const isAdminToken = adminToken && token === adminToken;
    
    if (!isAdminToken) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar service role para bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Obter parâmetros
    const url = new URL(req.url);
    let leadCode: string | null = null;

    if (req.method === 'GET') {
      leadCode = url.searchParams.get('lead_id') || url.searchParams.get('codigo') || url.searchParams.get('code');
    } else if (req.method === 'POST') {
      const body = await req.json();
      leadCode = body.lead_id || body.codigo || body.code;
    }

    if (!leadCode) {
      return new Response(
        JSON.stringify({ 
          error: 'lead_id é obrigatório',
          uso: 'GET /get-lead-qrcode?lead_id=12345 ou POST com body { "lead_id": "12345" }'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Buscando lead com lead_id: ${leadCode}`);

    // Buscar o lead pelo lead_id - agora inclui qr_code_image
    const { data: contato, error: contatoError } = await supabase
      .from('contatos')
      .select(`
        id,
        nome,
        telefone,
        email,
        status,
        lead_id,
        qr_token,
        qr_token_used,
        qr_code_image,
        vendedor_nome,
        empresa_id,
        empresas:empresa_id (
          nome_empresa
        )
      `)
      .eq('lead_id', leadCode)
      .maybeSingle();

    if (contatoError) {
      console.error('❌ Erro ao buscar contato:', contatoError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar lead', details: contatoError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contato) {
      return new Response(
        JSON.stringify({ error: 'Lead não encontrado com o código informado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se tem QR Code salvo
    if (!contato.qr_code_image) {
      return new Response(
        JSON.stringify({ 
          error: 'QR Code ainda não foi gerado para este lead',
          message: 'Acesse o lead no Kanban para gerar o QR Code primeiro'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ QR Code encontrado para lead: ${contato.nome}`);

    // Retornar o QR Code salvo no banco
    return new Response(
      JSON.stringify({
        success: true,
        lead: {
          id: contato.id,
          lead_id: contato.lead_id,
          nome: contato.nome,
          telefone: contato.telefone,
          email: contato.email,
          status: contato.status,
          empresa: (contato.empresas as any)?.nome_empresa || null,
          qr_token_used: contato.qr_token_used
        },
        qrcode: {
          data_url: contato.qr_code_image,
          token: contato.qr_token,
          already_used: contato.qr_token_used || false
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na função get-lead-qrcode:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
