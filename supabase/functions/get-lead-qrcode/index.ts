import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { qrcode } from 'https://deno.land/x/qrcode@v2.0.0/mod.ts';

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

    // Buscar o lead pelo lead_id
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

    // Se não tem qr_token, gerar um novo
    let qrToken = contato.qr_token;
    if (!qrToken) {
      qrToken = crypto.randomUUID();
      
      const { error: updateError } = await supabase
        .from('contatos')
        .update({
          qr_token: qrToken,
          qr_token_used: false,
          qr_token_used_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contato.id);

      if (updateError) {
        console.error('❌ Erro ao gerar qr_token:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao gerar QR Token', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`✅ QR Token gerado: ${qrToken}`);
    }

    // Gerar dados do QR Code
    const qrData = JSON.stringify({
      qr_token: qrToken,
      convidado_nome: contato.nome,
      convidado_telefone: contato.telefone || '',
      quem_convidou: contato.vendedor_nome || '',
      vendedor: contato.vendedor_nome || ''
    });

    // Gerar QR Code como base64
    const qrCodeBase64 = await qrcode(qrData, { size: 300 });
    
    // O qrcode retorna base64 puro, precisamos adicionar o prefixo data URL
    const qrCodeDataUrl = qrCodeBase64.startsWith('data:') 
      ? qrCodeBase64 
      : `data:image/gif;base64,${qrCodeBase64}`;

    console.log(`✅ QR Code gerado para lead: ${contato.nome}`);

    // Retornar resposta
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
          data_url: qrCodeDataUrl,
          token: qrToken,
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
