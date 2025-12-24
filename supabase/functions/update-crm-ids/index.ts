import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Allowed origins for CORS
const allowedOrigins = [
  'https://automatemaia.sagadatadriven.com.br',
  'https://lovable.dev',
  'https://id-preview--c4cc9f7d-5d60-4beb-ad66-04c36f0ace7c.lovable.app',
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

interface UpdateResult {
  cnpj: string
  crm_id: number
  status: 'success' | 'error' | 'not_found'
  message: string
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('tipo_acesso')
      .eq('id', user.id)
      .single()

    if (profile?.tipo_acesso !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Administrator privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CRM ID mapping data
    const crmMapping = [
      { cnpj: "00.283.283/0001-26", crm_id: 54858 },
      { cnpj: "01.104.751/0001-10", crm_id: 18424 },
      { cnpj: "01.104.751/0004-63", crm_id: 18432 },
      { cnpj: "01.104.751/0014-35", crm_id: 18434 },
      { cnpj: "02.656.280/0001-16", crm_id: 18400 },
      { cnpj: "03.267.961/0001-55", crm_id: 22602 },
      { cnpj: "03.267.961/0002-36", crm_id: 22601 },
      { cnpj: "03.267.961/0003-17", crm_id: 5155 },
      { cnpj: "03.267.961/0004-06", crm_id: 22603 },
      { cnpj: "03.947.095/0001-43", crm_id: 35646 },
      { cnpj: "05.471.879/0001-73", crm_id: 18383 },
      { cnpj: "05.471.879/0002-54", crm_id: 18384 },
      { cnpj: "05.471.879/0003-35", crm_id: 18426 },
      { cnpj: "05.471.879/0004-16", crm_id: 18427 },
      { cnpj: "05.471.879/0005-05", crm_id: 18425 },
      { cnpj: "08.748.749/0001-23", crm_id: 18352 },
      { cnpj: "08.748.749/0002-04", crm_id: 18376 },
      { cnpj: "08.748.749/0003-95", crm_id: 71335 },
      { cnpj: "08.748.749/0004-76", crm_id: 36510 },
      { cnpj: "08.748.749/0006-38", crm_id: 31991 },
      { cnpj: "08.860.168/0001-89", crm_id: 53764 },
      { cnpj: "08.860.168/0002-60", crm_id: 18418 },
      { cnpj: "08.860.168/0004-21", crm_id: 1592 },
      { cnpj: "08.860.168/0006-93", crm_id: 53766 },
      { cnpj: "08.860.168/0008-55", crm_id: 88180 },
      { cnpj: "09.102.044/0008-73", crm_id: 18409 },
      { cnpj: "09.102.044/0009-54", crm_id: 18414 },
      { cnpj: "09.102.044/0010-98", crm_id: 34885 },
      { cnpj: "09.102.044/0011-79", crm_id: 31994 },
      { cnpj: "09.102.044/0012-50", crm_id: 18404 },
      { cnpj: "09.102.044/0014-11", crm_id: 18403 },
      { cnpj: "09.102.044/0015-00", crm_id: 18407 },
      { cnpj: "09.102.044/0017-64", crm_id: 18406 },
      { cnpj: "09.102.044/0018-45", crm_id: 18417 },
      { cnpj: "09.102.044/0019-26", crm_id: 18408 },
      { cnpj: "09.102.044/0020-60", crm_id: 18416 },
      { cnpj: "09.102.044/0022-21", crm_id: 31990 },
      { cnpj: "09.102.044/0023-02", crm_id: 18413 },
      { cnpj: "09.102.044/0025-74", crm_id: 18415 },
      { cnpj: "09.102.044/0026-55", crm_id: 18405 },
      { cnpj: "09.102.044/0028-17", crm_id: 70950 },
      { cnpj: "09.102.044/0029-06", crm_id: 76125 },
      { cnpj: "09.102.044/0030-31", crm_id: 94246 },
      { cnpj: "09.348.217/0001-61", crm_id: 7119 },
      { cnpj: "09.348.217/0003-23", crm_id: 7122 },
      { cnpj: "09.348.217/0004-04", crm_id: 7125 },
      { cnpj: "09.348.217/0006-76", crm_id: 7126 },
      { cnpj: "10.084.986/0001-89", crm_id: 87543 },
      { cnpj: "10.272.533/0001-86", crm_id: 15836 },
      { cnpj: "10.272.533/0002-67", crm_id: 15827 },
      { cnpj: "10.272.533/0004-29", crm_id: 15828 },
      { cnpj: "10.272.533/0005-00", crm_id: 86643 },
      { cnpj: "11.458.618/0001-16", crm_id: 35647 },
      { cnpj: "11.727.257/0001-66", crm_id: 18388 },
      { cnpj: "11.727.257/0002-47", crm_id: 18391 },
      { cnpj: "11.727.257/0003-28", crm_id: 18389 },
      { cnpj: "11.727.257/0004-09", crm_id: 18390 },
      { cnpj: "11.727.257/0005-90", crm_id: 18386 },
      { cnpj: "11.727.257/0006-70", crm_id: 18431 },
      { cnpj: "11.748.698/0001-44", crm_id: 18387 },
      { cnpj: "11.748.698/0002-25", crm_id: 31491 },
      { cnpj: "11.748.698/0003-06", crm_id: 63957 },
      { cnpj: "12.657.826/0005-30", crm_id: 18371 },
      { cnpj: "12.657.826/0006-11", crm_id: 18366 },
      { cnpj: "12.657.826/0007-00", crm_id: 18365 },
      { cnpj: "12.657.826/0008-83", crm_id: 18368 },
      { cnpj: "12.657.826/0009-64", crm_id: 18363 },
      { cnpj: "13.243.978/0001-26", crm_id: 102155 },
      { cnpj: "13.243.978/0002-07", crm_id: 18377 },
      { cnpj: "14.007.304/0001-95", crm_id: 18351 },
      { cnpj: "14.234.954/0001-73", crm_id: 18429 },
      { cnpj: "14.234.954/0002-54", crm_id: 18430 },
      { cnpj: "16.611.298/0001-06", crm_id: 38181 },
      { cnpj: "19.945.014/0001-06", crm_id: 18354 },
      { cnpj: "19.945.014/0002-97", crm_id: 18355 },
      { cnpj: "19.945.014/0003-78", crm_id: 18357 },
      { cnpj: "19.945.014/0004-59", crm_id: 18356 },
      { cnpj: "19.945.014/0005-30", crm_id: 18372 },
      { cnpj: "19.945.014/0006-10", crm_id: 18373 },
      { cnpj: "19.945.014/0007-00", crm_id: 18375 },
      { cnpj: "20.374.616/0001-30", crm_id: 18412 },
      { cnpj: "20.374.616/0002-10", crm_id: 52368 },
      { cnpj: "20.374.616/0005-63", crm_id: 34163 },
      { cnpj: "20.379.987/0001-04", crm_id: 9057 },
      { cnpj: "20.379.987/0003-76", crm_id: 9053 },
      { cnpj: "20.379.987/0006-19", crm_id: 9055 },
      { cnpj: "20.379.987/0009-61", crm_id: 92807 },
      { cnpj: "21.214.513/0001-75", crm_id: 18374 },
      { cnpj: "21.333.642/0001-82", crm_id: 72178 },
      { cnpj: "21.333.642/0002-63", crm_id: 72176 },
      { cnpj: "21.333.642/0003-44", crm_id: 96522 },
      { cnpj: "21.333.642/0004-25", crm_id: 86776 },
      { cnpj: "21.333.642/0004-26", crm_id: 86644 },
      { cnpj: "21.333.642/0005-06", crm_id: 86646 },
      { cnpj: "21.333.642/9999-99", crm_id: 86642 },
      { cnpj: "21.428.039/0001-84", crm_id: 18367 },
      { cnpj: "22.280.413/0001-00", crm_id: 18369 },
      { cnpj: "22.280.413/0002-90", crm_id: 9859 },
      { cnpj: "26.046.380/0001-99", crm_id: 53767 },
      { cnpj: "26.343.161/0001-71", crm_id: 31988 },
      { cnpj: "30.903.216/0001-28", crm_id: 18401 },
      { cnpj: "32.108.001/0001-40", crm_id: 37571 },
      { cnpj: "33.863.628/0001-70", crm_id: 54939 },
      { cnpj: "38.461.145/0001-62", crm_id: 70952 },
      { cnpj: "45.616.451/0001-96", crm_id: 51659 },
      { cnpj: "50.071.859/0001-60", crm_id: 66479 },
      { cnpj: "51.423.528/0001-04", crm_id: 67169 },
      { cnpj: "53.380.234/0001-78", crm_id: 38183 },
      { cnpj: "58.129.819/0001-33", crm_id: 67166 },
      { cnpj: "74.150.889/0001-20", crm_id: 20429 },
      { cnpj: "76.189.427/0001-41", crm_id: 18379 },
      { cnpj: "78.675.918/0001-28", crm_id: 53832 },
      { cnpj: "86.761.653/0001-09", crm_id: 88179 }
    ]

    console.log(`Starting CRM ID update for ${crmMapping.length} companies`)

    const results: UpdateResult[] = []
    let successCount = 0
    let errorCount = 0
    let notFoundCount = 0

    // Process each company
    for (const item of crmMapping) {
      try {
        console.log(`Processing CNPJ: ${item.cnpj} with CRM ID: ${item.crm_id}`)
        
        // Check if company exists
        const { data: existingCompany, error: findError } = await supabase
          .from('empresas')
          .select('id, nome_empresa')
          .eq('cnpj', item.cnpj)
          .single()

        if (findError || !existingCompany) {
          console.log(`Company not found for CNPJ: ${item.cnpj}`)
          results.push({
            cnpj: item.cnpj,
            crm_id: item.crm_id,
            status: 'not_found',
            message: 'Empresa não encontrada'
          })
          notFoundCount++
          continue
        }

        // Update the company with CRM ID
        const { error: updateError } = await supabase
          .from('empresas')
          .update({ crm_id: item.crm_id.toString() })
          .eq('cnpj', item.cnpj)

        if (updateError) {
          console.error(`Error updating company ${item.cnpj}:`, updateError)
          results.push({
            cnpj: item.cnpj,
            crm_id: item.crm_id,
            status: 'error',
            message: updateError.message
          })
          errorCount++
        } else {
          console.log(`Successfully updated ${existingCompany.nome_empresa} with CRM ID ${item.crm_id}`)
          results.push({
            cnpj: item.cnpj,
            crm_id: item.crm_id,
            status: 'success',
            message: `Atualizado: ${existingCompany.nome_empresa}`
          })
          successCount++
        }
      } catch (err) {
        console.error(`Unexpected error for CNPJ ${item.cnpj}:`, err)
        results.push({
          cnpj: item.cnpj,
          crm_id: item.crm_id,
          status: 'error',
          message: err instanceof Error ? err.message : 'Erro inesperado'
        })
        errorCount++
      }
    }

    const summary = {
      total: crmMapping.length,
      success: successCount,
      errors: errorCount,
      not_found: notFoundCount,
      details: results
    }

    console.log('CRM ID update completed:', summary)

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in update-crm-ids function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})