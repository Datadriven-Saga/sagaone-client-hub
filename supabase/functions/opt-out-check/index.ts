import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Allowed origins for CORS
const allowedOrigins = [
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

interface OptOutCheckRequest {
  canal: 'Whatsapp' | 'Ligação' | 'SMS' | 'E-mail'
  telefone?: string
  email?: string
  empresa_id?: string
}

interface OptOutCheckResponse {
  allow: boolean
  reason?: string
  match?: {
    data_optout: string
    canal: string
    empresa: string
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const body: OptOutCheckRequest = await req.json()

    // Validate required fields
    if (!body.canal) {
      return new Response(
        JSON.stringify({
          error: 'Canal é obrigatório',
          allow: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!body.telefone && !body.email) {
      return new Response(
        JSON.stringify({
          error: 'Pelo menos telefone ou email deve ser fornecido',
          allow: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Checking opt-out for:', {
      canal: body.canal,
      telefone: body.telefone,
      email: body.email,
      empresa_id: body.empresa_id
    })

    // Normalize phone to E.164 if provided
    let normalizedPhone = null
    if (body.telefone) {
      const { data: phoneResult } = await supabaseClient
        .rpc('normalize_phone_e164', { phone_input: body.telefone })
      normalizedPhone = phoneResult
    }

    // Normalize email if provided
    const normalizedEmail = body.email ? body.email.toLowerCase().trim() : null

    // Build query to check for opt-out
    let query = supabaseClient
      .from('opt_outs')
      .select(`
        id,
        data_optout,
        canal,
        empresa_id,
        telefone_e164,
        email_normalizado,
        empresas:empresa_id(nome_empresa)
      `)
      .eq('canal', body.canal)

    // Add identifier filters
    const orConditions = []
    if (normalizedPhone) {
      orConditions.push(`telefone_e164.eq.${normalizedPhone}`)
    }
    if (normalizedEmail) {
      orConditions.push(`email_normalizado.eq.${normalizedEmail}`)
    }

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','))
    }

    // Add empresa filter if provided
    if (body.empresa_id) {
      query = query.eq('empresa_id', body.empresa_id)
    }

    const { data: optOuts, error } = await query

    if (error) {
      console.error('Erro ao consultar opt-outs:', error)
      return new Response(
        JSON.stringify({
          error: 'Erro interno do servidor',
          allow: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Opt-outs encontrados:', optOuts?.length || 0)

    // If any opt-out found, block communication
    if (optOuts && optOuts.length > 0) {
      const match = optOuts[0]
      const response: OptOutCheckResponse = {
        allow: false,
        reason: `Opt-out encontrado para ${body.canal}`,
        match: {
          data_optout: match.data_optout,
          canal: match.canal,
          empresa: (match as any).empresas?.nome_empresa || 'N/A'
        }
      }

      console.log('Comunicação bloqueada:', response)

      return new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // No opt-out found, allow communication
    const response: OptOutCheckResponse = {
      allow: true,
      reason: 'Nenhum opt-out encontrado'
    }

    console.log('Comunicação permitida:', response)

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Erro na função opt-out-check:', error)
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        allow: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})