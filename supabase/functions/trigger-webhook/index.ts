import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

function uint8ToBase64(bytes: Uint8Array) {
  // Evita stack overflow em arrays grandes
  const CHUNK_SIZE = 0x8000; // 32KB
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function enrichVideoBase64ForTemplateWebhook(dados: any) {
  try {
    const components = dados?.payload?.components;
    if (!Array.isArray(components)) return dados;

    let changed = false;

    for (const comp of components) {
      const isVideoHeader =
        comp?.type === "HEADER" &&
        String(comp?.format || "").toUpperCase() === "VIDEO" &&
        typeof comp?.media_url === "string" &&
        comp.media_url.length > 0;

      if (!isVideoHeader) continue;

      // Se já vier base64, não mexe
      if (comp?.media_base64) continue;

      const mediaUrl = comp.media_url as string;
      console.log("🎥 Enriquecendo template de VÍDEO com base64 a partir de:", mediaUrl);

      const res = await fetch(mediaUrl);
      if (!res.ok) {
        console.error("❌ Falha ao baixar vídeo para base64:", res.status, mediaUrl);
        throw new Error(`VIDEO_FETCH_FAILED:${res.status}`);
      }

      const contentLength = res.headers.get("content-length");
      const length = contentLength ? Number(contentLength) : null;
      if (length && length > MAX_VIDEO_BYTES) {
        throw new Error(`VIDEO_TOO_LARGE_BYTES:${length}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_VIDEO_BYTES) {
        throw new Error(`VIDEO_TOO_LARGE_BYTES:${arrayBuffer.byteLength}`);
      }

      const bytes = new Uint8Array(arrayBuffer);
      const base64 = uint8ToBase64(bytes);

      comp.media_base64 = base64;
      comp.media_mime_type = comp.media_mime_type || res.headers.get("content-type") || "video/mp4";
      comp.media_type = comp.media_type || "video";
      comp.media_length = comp.media_length || arrayBuffer.byteLength;
      changed = true;

      console.log("✅ Vídeo convertido para base64 com sucesso. bytes=", arrayBuffer.byteLength);
    }

    if (!changed) return dados;

    return {
      ...dados,
      payload: {
        ...dados.payload,
        components,
      },
    };
  } catch (err) {
    console.error("Erro ao enriquecer vídeo em base64:", err);
    throw err;
  }
}
// Allowed origins for CORS
const allowedOrigins = [
  'https://one.sagadatadriven.com.br',
  'https://automatemaia.sagadatadriven.com.br',
  'https://lovable.dev',
  'https://7bc578c3-4b3d-4f33-830e-6157c828c9e5.lovableproject.com',
  'https://id-preview--7bc578c3-4b3d-4f33-830e-6157c828c9e5.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '')) || origin === allowed);
  
  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Validates a webhook URL to prevent SSRF attacks
 * Blocks localhost, private IPs, and cloud metadata endpoints
 */
function isValidWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost variations
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('127.') ||
        hostname === '0.0.0.0' ||
        hostname === '::1') {
      return { valid: false, error: 'Localhost URLs not allowed' };
    }
    
    // Block private IP ranges (RFC 1918)
    const ipv4Parts = hostname.split('.');
    if (ipv4Parts.length === 4 && ipv4Parts.every(p => !isNaN(parseInt(p)))) {
      const first = parseInt(ipv4Parts[0]);
      const second = parseInt(ipv4Parts[1]);
      
      if (first === 10 ||                                    // 10.0.0.0/8
          (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
          (first === 192 && second === 168) ||               // 192.168.0.0/16
          (first === 169 && second === 254)) {               // Link-local
        return { valid: false, error: 'Private IPs not allowed' };
      }
    }
    
    // Block cloud metadata endpoints
    const blockedHosts = [
      '169.254.169.254',
      'metadata.google.internal',
      'metadata',
      'instance-data',
    ];
    
    if (blockedHosts.some(blocked => hostname.includes(blocked))) {
      return { valid: false, error: 'Metadata endpoints not allowed' };
    }
    
    // Block internal services
    const internalServices = [
      'supabase-kong',
      'supabase-db',
      'postgres',
      'postgresql',
      'internal',
    ];
    
    if (internalServices.some(service => hostname.includes(service))) {
      return { valid: false, error: 'Internal services not allowed' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user info from JWT
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false
        },
        global: {
          headers: authHeader ? { authorization: authHeader } : {}
        }
      }
    );

    // Get user info for audit logs
    const { data: { user } } = await supabaseClient.auth.getUser(jwt);
    const userId = user?.id;
    const userEmail = user?.email;
    
    console.log(`API trigger-webhook accessed by user: ${userEmail} (${userId})`);
    console.log(`Webhook trigger request body:`, await req.clone().json());

    const { gatilho, dados } = await req.json();

    console.log('🎯 Trigger webhook called with:', { gatilho, dados });
    console.log('🔍 Request body parsed successfully');

    if (!gatilho || !dados) {
      return new Response(
        JSON.stringify({ error: 'gatilho e dados são obrigatórios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extrair empresa_id dos dados para filtrar gatilhos corretamente
    const empresaId = dados.empresa_id;
    console.log('🏢 Empresa ID recebido:', empresaId);

    // Criar cliente com service role para bypessar RLS e buscar gatilhos da empresa correta
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    // ══════════════════════════════════════════════════════════════
    // Handler especial: movimentacao_lead_kanban (não usa tabela gatilhos)
    // ══════════════════════════════════════════════════════════════
    if (gatilho === 'movimentacao_lead_kanban') {
      console.log('🔄 Processando movimentacao_lead_kanban');

      // 1. Verificar se não é Pri IA
      const PRI_IA_USER_ID = Deno.env.get('PRI_IA_USER_ID');
      if (dados.usuario_id === PRI_IA_USER_ID) {
        console.log('⏭️ Ignorando: ação da Pri IA');
        return new Response(JSON.stringify({ skipped: true, reason: 'pri_ia' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Verificar feature flag per_empresa
      const { data: flagEnabled } = await supabaseServiceClient.rpc('is_feature_enabled_for_empresa', {
        p_flag_key: 'webhook_movimentacao_lead',
        p_empresa_id: dados.empresa_id
      });

      if (!flagEnabled) {
        console.log('⏭️ Ignorando: feature flag desabilitada para empresa', dados.empresa_id);
        return new Response(JSON.stringify({ skipped: true, reason: 'flag_disabled' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 3. Verificar canal da prospecção (excluir IA WhatsApp e Ligação)
      const { data: prospeccaoData } = await supabaseServiceClient
        .from('prospeccoes')
        .select('canal, titulo')
        .eq('id', dados.prospeccao_id)
        .single();

      if (prospeccaoData?.canal !== 'Mensal' && prospeccaoData?.canal !== 'Grande Evento') {
        console.log('⏭️ Ignorando: canal não elegível:', prospeccaoData?.canal);
        return new Response(JSON.stringify({ skipped: true, reason: 'canal_nao_elegivel', canal: prospeccaoData?.canal }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 4. Buscar dados do contato (inclui codigo_proposta para propagação)
      const { data: contatoData } = await supabaseServiceClient
        .from('contatos')
        .select('nome, telefone, webhook_ativado, codigo_proposta')
        .eq('id', dados.contato_id)
        .single();

      if (!contatoData) {
        console.error('❌ Contato não encontrado:', dados.contato_id);
        return new Response(JSON.stringify({ error: 'contato_not_found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 5. Verificar regra de ativação
      if (!contatoData.webhook_ativado && dados.status_novo !== 'Em Espera') {
        console.log('⏭️ Ignorando: lead não passou por Em Espera ainda');
        return new Response(JSON.stringify({ skipped: true, reason: 'nao_ativado' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const primeiraAtivacao = !contatoData.webhook_ativado && dados.status_novo === 'Em Espera';

      // 6. Buscar dealer_id da empresa
      const { data: empresaData } = await supabaseServiceClient
        .from('empresas')
        .select('crm_id')
        .eq('id', dados.empresa_id)
        .single();

      // 7. Disparar webhook
      const webhookUrl = Deno.env.get('WEBHOOK_MOVIMENTACAO_LEAD_URL');
      if (!webhookUrl) {
        console.error('❌ WEBHOOK_MOVIMENTACAO_LEAD_URL não configurada');
        return new Response(JSON.stringify({ error: 'webhook_url_missing' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validar URL (SSRF)
      const urlCheck = isValidWebhookUrl(webhookUrl);
      if (!urlCheck.valid) {
        console.error('❌ URL bloqueada:', urlCheck.error);
        return new Response(JSON.stringify({ error: 'webhook_url_blocked', detail: urlCheck.error }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const payload: Record<string, any> = {
        nome: contatoData.nome,
        telefone: contatoData.telefone,
        dealer_id: empresaData?.crm_id,
        nome_evento: prospeccaoData?.titulo,
        status_anterior: dados.status_anterior,
        status_novo: dados.status_novo,
        primeira_ativacao: primeiraAtivacao,
        contato_id: dados.contato_id,
        lead_id: dados.lead_id,
        empresa_id: dados.empresa_id,
        prospeccao_id: dados.prospeccao_id,
        codigo_proposta: contatoData.codigo_proposta ?? null,
      };

      console.log('📤 Disparando webhook movimentação:', JSON.stringify(payload));

      const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(SAGA_ONE ? { 'x-saga-one': SAGA_ONE } : {})
        },
        body: JSON.stringify(payload)
      });

      let responseText = '';
      try { responseText = await webhookResponse.text(); } catch {}
      console.log(`✅ Webhook respondeu: ${webhookResponse.status}`, responseText.substring(0, 500));

      // 7.1 Tentar capturar codigo_proposta da resposta e persistir
      let capturedCodigoProposta: string | null = null;
      if (webhookResponse.ok && responseText) {
        try {
          const parsed = JSON.parse(responseText);
          const candidate =
            parsed?.codigo_proposta ??
            parsed?.proposalId ??
            parsed?.proposal_id ??
            parsed?.data?.codigo_proposta ??
            parsed?.data?.proposalId ??
            parsed?.data?.proposal_id ??
            null;
          if (candidate !== null && candidate !== undefined && String(candidate).trim() !== '') {
            capturedCodigoProposta = String(candidate).trim();
          }
        } catch (e) {
          console.log('ℹ️ Resposta do webhook não é JSON válido, ignorando captura de codigo_proposta');
        }
      }

      if (capturedCodigoProposta && capturedCodigoProposta !== contatoData.codigo_proposta) {
        const { error: updErr } = await supabaseServiceClient
          .from('contatos')
          .update({ codigo_proposta: capturedCodigoProposta })
          .eq('id', dados.contato_id);
        if (updErr) {
          console.error('❌ Erro ao salvar codigo_proposta:', updErr.message);
        } else {
          console.log(`💾 codigo_proposta capturado e salvo: ${capturedCodigoProposta} (contato ${dados.contato_id})`);
        }
      }

      // 8. Se primeira ativação, marcar contato
      if (primeiraAtivacao) {
        await supabaseServiceClient
          .from('contatos')
          .update({ webhook_ativado: true })
          .eq('id', dados.contato_id);
        console.log('✅ Contato marcado com webhook_ativado = true');
      }

      return new Response(JSON.stringify({
        success: true,
        primeira_ativacao: primeiraAtivacao,
        webhook_status: webhookResponse.status
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar gatilhos ativos para o tipo de evento E para a empresa específica
    let gatilhosQuery = supabaseServiceClient
      .from('gatilhos')
      .select('*')
      .eq('acoes->>tipo_evento', gatilho)
      .eq('status', 'Ativo');
    
    // Se temos empresa_id, filtrar por ela
    if (empresaId) {
      gatilhosQuery = gatilhosQuery.eq('empresa_id', empresaId);
    }
    
    const { data: gatilhos, error } = await gatilhosQuery;

    console.log(`🔍 Gatilhos query - empresa_id: ${empresaId}, tipo_evento: ${gatilho}`);

    // Buscar também followups ativos de agentes para o tipo de evento
    // Incluir verificação se o agente está ativo
    let followupsQuery = supabaseServiceClient
      .from('agente_followups')
      .select(`
        *,
        agentes_ia!inner(
          id,
          ativo
        )
      `)
      .eq('tipo', gatilho)
      .eq('ativo', true)
      .eq('agentes_ia.ativo', true);
    
    // Se temos empresa_id, filtrar por ela
    if (empresaId) {
      followupsQuery = followupsQuery.eq('empresa_id', empresaId);
    }
    
    const { data: followups, error: followupError } = await followupsQuery;

    // Variáveis para dados do agente PRI
    let agenteData: { telefone: string | null; dealer_id: string | null } | null = null;
    let eventIdPri: string | null = null;

    // Se for novo contato na prospecção, verificar se é canal Whatsapp e buscar dados do agente
    if (gatilho === 'novo_contato_prospeccao' && dados?.prospeccao_id) {
      const { data: prospeccao } = await supabaseClient
        .from('prospeccoes')
        .select('canal, empresa_id, event_id_pri')
        .eq('id', dados.prospeccao_id)
        .single();
      
      // Capturar event_id_pri da prospecção
      if (prospeccao?.event_id_pri) {
        eventIdPri = prospeccao.event_id_pri;
        console.log('🆔 Event ID PRI encontrado:', eventIdPri);
      }
      
      // Só dispara webhook se for canal Whatsapp
      if (prospeccao?.canal !== 'Whatsapp') {
        console.log('Webhook não disparado: campanha não é do canal Whatsapp');
        return new Response(
          JSON.stringify({
            success: true,
            gatilho: gatilho,
            message: 'Webhook não disparado: campanha de ligação não dispara webhook automaticamente',
            webhooks_disparados: 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Buscar dados do agente ativo da empresa (PRI)
      if (prospeccao?.empresa_id) {
        const { data: agente } = await supabaseClient
          .from('agentes_ia')
          .select('telefone, dealer_id')
          .eq('empresa_id', prospeccao.empresa_id)
          .eq('ativo', true)
          .limit(1)
          .single();
        
        if (agente) {
          agenteData = {
            telefone: agente.telefone,
            dealer_id: agente.dealer_id
          };
          console.log('📱 Dados do agente PRI encontrados:', agenteData);
        } else {
          console.log('⚠️ Nenhum agente ativo encontrado para a empresa');
        }
      }
    }

    if (error) {
      console.error('Erro ao buscar gatilhos:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar gatilhos' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (followupError) {
      console.error('Erro ao buscar followups:', followupError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar followups' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Gatilhos encontrados: ${gatilhos?.length || 0}`);
    console.log(`Followups encontrados: ${followups?.length || 0}`);
    
    const totalTriggers = (gatilhos?.length || 0) + (followups?.length || 0);
    
    if (totalTriggers === 0) {
      console.log('Nenhum gatilho ou followup encontrado para:', gatilho);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum gatilho ou followup ativo encontrado para este evento',
          gatilho: gatilho,
          webhooks_disparados: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const webhooksDispareados = [];
    let webhookResponseData: any = null;

    // Processar gatilhos da tabela gatilhos
    for (const gatilhoItem of gatilhos || []) {
      try {
        const acoes = gatilhoItem.acoes || {};
        const webhookUrl = acoes.webhook_url;

        if (!webhookUrl) {
          console.log(`Gatilho ${gatilhoItem.nome} não possui webhook_url configurado`);
          continue;
        }

        // Validar URL para prevenir SSRF
        const urlValidation = isValidWebhookUrl(webhookUrl);
        if (!urlValidation.valid) {
          console.error(`URL bloqueada para gatilho ${gatilhoItem.nome}: ${urlValidation.error}`);
          webhooksDispareados.push({
            gatilho: gatilhoItem.nome,
            url: webhookUrl,
            status: 'blocked',
            error: urlValidation.error
          });
          continue;
        }

        console.log(`Disparando webhook gatilho: ${webhookUrl}`);
        console.log(`Descrição do gatilho: ${gatilhoItem.descricao}`);
        
        // Preparar dados do webhook baseado na descrição e tipo do gatilho
        let webhookBody: any = {
          gatilho: gatilho,
          gatilho_id: gatilhoItem.id,
          gatilho_nome: gatilhoItem.nome,
          timestamp: new Date().toISOString()
        };

        // Para gatilho de novo contato na prospecção
        if (gatilho === 'novo_contato_prospeccao' && dados) {
          webhookBody = {
            ...webhookBody,
            nome: dados.nome || '',
            telefone: dados.telefone || '',
            email: dados.email || '',
            id: dados.contato_id || dados.id || '',
            leadId: dados.lead_id || null,
            status: dados.status || 'Novo',
            prospeccao_id: dados.prospeccao_id || '',
            event_id_pri: eventIdPri || '',
            // Dados do agente PRI
            telefone_pri: agenteData?.telefone || '',
            dealerId: agenteData?.dealer_id || ''
          };
        }
        // Para novo_template_whatsapp, enviar os dados diretamente no body
        else if (gatilho === 'novo_template_whatsapp' && dados) {
          // Enviar dados completos incluindo media_base64 para o webhook externo
          webhookBody = {
            ...webhookBody,
            ...dados
          };
        }
        // Para outros gatilhos, incluir dados completos
        else {
          webhookBody = {
            ...webhookBody,
            dados: dados
          };
        }

        console.log('Webhook body (truncated):', JSON.stringify(webhookBody, null, 2).substring(0, 2000));
        
        // Obter token de autorização para chamadas externas
        const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
        
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
          },
          body: JSON.stringify(webhookBody)
        });

        // Capturar resposta do webhook para retornar ao cliente
        let responseBody: any = null;
        try {
          const responseText = await webhookResponse.text();
          console.log(`Resposta do webhook (${webhookResponse.status}):`, responseText);
          responseBody = JSON.parse(responseText);
          
          // Se for webhook de template e tiver dados do Meta, armazenar
          if (gatilho === 'novo_template_whatsapp' && responseBody) {
            webhookResponseData = responseBody;
          }
        } catch (parseErr) {
          console.log('Resposta do webhook não é JSON válido');
        }

        webhooksDispareados.push({
          gatilho: gatilhoItem.nome,
          url: webhookUrl,
          status: 'disparado',
          response: webhookResponse.status,
          response_data: responseBody
        });
        
        console.log(`Webhook disparado com sucesso para: ${gatilhoItem.nome}`);

        // Atualizar última execução
        await supabaseClient
          .from('gatilhos')
          .update({ ultima_execucao: new Date().toISOString() })
          .eq('id', gatilhoItem.id);

      } catch (error) {
        console.error(`Erro ao disparar webhook para ${gatilhoItem.nome}:`, error);
        webhooksDispareados.push({
          gatilho: gatilhoItem.nome,
          url: gatilhoItem.acoes?.webhook_url || 'N/A',
          status: 'erro',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Processar followups da tabela agente_followups
    for (const followupItem of followups || []) {
      try {
        const webhookUrl = followupItem.webhook_url;
        
        if (!webhookUrl) {
          console.log(`Followup ${followupItem.nome} não possui webhook_url configurado`);
          continue;
        }

        // Validar URL para prevenir SSRF
        const urlValidation = isValidWebhookUrl(webhookUrl);
        if (!urlValidation.valid) {
          console.error(`URL bloqueada para followup ${followupItem.nome}: ${urlValidation.error}`);
          webhooksDispareados.push({
            gatilho: followupItem.nome,
            url: webhookUrl,
            status: 'blocked',
            error: urlValidation.error
          });
          continue;
        }

        console.log(`Disparando webhook followup para: ${followupItem.nome} em ${webhookUrl}`);

        let webhookBody: any = {
          gatilho: gatilho,
          followup_id: followupItem.id,
          followup_nome: followupItem.nome,
          agente_id: followupItem.agente_id,
          timestamp: new Date().toISOString()
        };

        // Para gatilho de novo contato na prospecção
        if (gatilho === 'novo_contato_prospeccao' && dados) {
          webhookBody = {
            ...webhookBody,
            nome: dados.nome || '',
            telefone: dados.telefone || '',
            email: dados.email || '',
            leadId: dados.lead_id || null,
            status: dados.status || '',
            prospeccao_id: dados.prospeccao_id || '',
            event_id_pri: eventIdPri || '',
            // Dados do agente PRI
            telefone_pri: agenteData?.telefone || '',
            dealerId: agenteData?.dealer_id || '',
            timestamp: new Date().toISOString()
          };
        }

        console.log('Body:', JSON.stringify(webhookBody, null, 2));

        // Obter token de autorização para chamadas externas
        const SAGA_ONE_FOLLOWUP = Deno.env.get('SAGA_ONE') || '';

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SAGA_ONE_FOLLOWUP ? { 'saga_one_supabase': SAGA_ONE_FOLLOWUP } : {}),
          },
          body: JSON.stringify(webhookBody)
        });

        webhooksDispareados.push({
          gatilho: followupItem.nome,
          url: webhookUrl,
          status: 'disparado',
          response: response.status
        });
        
        console.log(`Webhook followup disparado com sucesso para: ${followupItem.nome}`);

      } catch (error) {
        console.error(`Erro ao disparar webhook followup para ${followupItem.nome}:`, error);
        webhooksDispareados.push({
          gatilho: followupItem.nome,
          url: followupItem.webhook_url || 'N/A',
          status: 'erro',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        gatilho: gatilho,
        webhooks_disparados: webhooksDispareados.length,
        detalhes: webhooksDispareados,
        webhook_response: webhookResponseData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro na função trigger-webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});