import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

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

    // Buscar o lead pelo lead_id com dados da prospecção vinculada
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
    
    // Buscar prospecção mais recente da empresa do contato (para evento_id e evento_nome)
    let prospeccaoData: { id: string; titulo: string } | null = null;

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

    // Buscar prospecção vinculada à empresa do contato
    if (contato.empresa_id) {
      const { data: prospeccao } = await supabase
        .from('prospeccoes')
        .select('id, titulo')
        .eq('empresa_id', contato.empresa_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (prospeccao) {
        prospeccaoData = prospeccao;
        console.log(`📋 Prospecção encontrada: ${prospeccao.titulo} (${prospeccao.id})`);
      }
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

    // Gerar dados do QR Code EXATAMENTE como no frontend (ConviteTab.tsx)
    // Usar vendedor_nome tanto para quem_convidou quanto para vendedor
    const qrData = JSON.stringify({
      qr_token: qrToken,
      convidado_nome: contato.nome,
      convidado_telefone: contato.telefone || '',
      quem_convidou: contato.vendedor_nome || '',
      vendedor: contato.vendedor_nome || '',
      evento_id: prospeccaoData?.id || '',
      evento_nome: prospeccaoData?.titulo || ''
    });

    console.log(`📦 QR Data: ${qrData}`);

    // Gerar QR Code usando a mesma biblioteca e parâmetros do frontend
    // Frontend usa: QRCodeLib.toDataURL(qrData, { width: 300, margin: 2 })
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, { 
      width: 300, 
      margin: 2,
      errorCorrectionLevel: 'M'
    });

    console.log(`✅ QR Code gerado para lead: ${contato.nome}`);

    // Retornar resposta com dados do evento
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
        evento: prospeccaoData ? {
          id: prospeccaoData.id,
          nome: prospeccaoData.titulo
        } : null,
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
