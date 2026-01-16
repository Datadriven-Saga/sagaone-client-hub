import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import QRCode from 'https://esm.sh/qrcode@1.5.4?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para gerar SVG do convite (igual ao card do frontend)
function generateConviteSVG(qrCodeDataUrl: string, nome: string, telefone: string): string {
  // Dimensões baseadas no card do frontend (max-w-sm = 384px, p-6 = 24px padding)
  const cardWidth = 384;
  const cardPadding = 24;
  const qrSize = 192; // w-48 h-48
  const qrPadding = 16; // p-4
  
  // Calcular altura baseada no conteúdo
  const nameHeight = 28; // text-lg font-semibold
  const phoneHeight = telefone ? 20 : 0; // text-sm
  const spacing = 16; // space-y-4
  const totalHeight = cardPadding * 2 + qrPadding * 2 + qrSize + spacing + nameHeight + phoneHeight + 8;
  
  // Centralizar elementos
  const centerX = cardWidth / 2;
  const qrX = centerX - (qrSize / 2);
  const qrY = cardPadding + qrPadding;
  const nameY = qrY + qrSize + qrPadding + spacing + nameHeight;
  const phoneY = nameY + phoneHeight + 4;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${cardWidth}" height="${totalHeight}" viewBox="0 0 ${cardWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <!-- Fundo branco com borda arredondada (igual ao Card) -->
  <rect x="0" y="0" width="${cardWidth}" height="${totalHeight}" rx="12" ry="12" fill="white" stroke="#e5e7eb" stroke-width="1"/>
  
  <!-- Container do QR Code com fundo branco e borda arredondada -->
  <rect x="${qrX - qrPadding}" y="${qrY - qrPadding}" width="${qrSize + qrPadding * 2}" height="${qrSize + qrPadding * 2}" rx="12" ry="12" fill="white"/>
  
  <!-- QR Code -->
  <image x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" href="${qrCodeDataUrl}"/>
  
  <!-- Nome do convidado (font-semibold text-lg = 18px, font-weight 600) -->
  <text x="${centerX}" y="${nameY}" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#0f172a" text-anchor="middle">${escapeXml(nome || 'Sem nome')}</text>
  
  ${telefone ? `<!-- Telefone (text-sm text-muted-foreground = 14px, cor cinza) -->
  <text x="${centerX}" y="${phoneY}" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#64748b" text-anchor="middle">${escapeXml(telefone)}</text>` : ''}
</svg>`;
}

// Função para escapar caracteres especiais em XML
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Converter SVG para PNG usando canvas
async function svgToPng(svgString: string): Promise<string> {
  // Para Edge Functions, retornamos o SVG como base64
  // O SVG é compatível com a maioria dos casos de uso
  const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${base64Svg}`;
}

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
    let format: string = 'json'; // json, svg, ou image

    if (req.method === 'GET') {
      leadCode = url.searchParams.get('lead_id') || url.searchParams.get('codigo') || url.searchParams.get('code');
      format = url.searchParams.get('format') || 'json';
    } else if (req.method === 'POST') {
      const body = await req.json();
      leadCode = body.lead_id || body.codigo || body.code;
      format = body.format || 'json';
    }

    if (!leadCode) {
      return new Response(
        JSON.stringify({ 
          error: 'lead_id é obrigatório',
          uso: 'GET /get-lead-qrcode?lead_id=12345&format=json|svg|image'
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

    // Gerar QR Code EXATAMENTE como no frontend: QRCodeLib.toDataURL(qrData, { width: 300, margin: 2 })
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, { 
      width: 300, 
      margin: 2,
      errorCorrectionLevel: 'M'
    });

    console.log(`✅ QR Code gerado para lead: ${contato.nome}`);

    // Gerar imagem do convite (igual ao "Salvar Convite" do frontend)
    const conviteSvg = generateConviteSVG(
      qrCodeDataUrl,
      contato.nome || 'Sem nome',
      contato.telefone || ''
    );
    const conviteImageUrl = await svgToPng(conviteSvg);

    // Se formato é svg ou image, retornar diretamente a imagem
    if (format === 'svg') {
      return new Response(conviteSvg, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'image/svg+xml' }
      });
    }

    if (format === 'image') {
      // Decodificar base64 e retornar como imagem
      const base64Data = conviteImageUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return new Response(bytes, {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="convite-${contato.nome?.replace(/\s+/g, '-') || 'cliente'}.svg"`
        }
      });
    }

    // Retornar resposta JSON com dados completos
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
        },
        convite: {
          data_url: conviteImageUrl,
          format: 'svg+xml',
          description: 'Imagem do convite igual ao botão "Salvar Convite" do frontend'
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
