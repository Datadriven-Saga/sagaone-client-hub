import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    // Verificar se o usuário está autenticado e é admin
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se é admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tipo_acesso')
      .eq('id', userData.user.id)
      .single()

    if (profileError || profile?.tipo_acesso !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { empresas } = await req.json()

    const results = {
      success: 0,
      errors: 0,
      details: [] as any[]
    }

    // Lista de empresas para importar
    const empresasList = [
      { nome_empresa: "SAGA CORRETORA DE SEGUROS", cnpj: "00.283.283/0001-26", grupo_empresarial: "Saga", uf: "GO", marca: "Seguros" },
      { nome_empresa: "Saga Volkswagen T7", cnpj: "01.104.751/0001-10", grupo_empresarial: "Saga", uf: "GO", marca: "Volkswagem" },
      { nome_empresa: "Saga Volkswagen BSB", cnpj: "01.104.751/0004-63", grupo_empresarial: "Saga", uf: "DF", marca: "Volkswagem" },
      { nome_empresa: "Saga Volkswagen Gama", cnpj: "01.104.751/0014-35", grupo_empresarial: "Saga", uf: "DF", marca: "Volkswagem" },
      { nome_empresa: "VÁRZEA GRANDE - PRIMEIRA MÃO", cnpj: "02.656.280/0001-16", grupo_empresarial: "Saga", uf: "MT", marca: "Primeira Mão" },
      { nome_empresa: "JOÃO NAVES - PRIMEIRA MÃO", cnpj: "03.267.961/0001-55", grupo_empresarial: "Saga", uf: "MG", marca: "Primeira Mão" },
      { nome_empresa: "DIGITAL UDI - PRIMEIRA MÃO", cnpj: "03.267.961/0002-36", grupo_empresarial: "Saga", uf: "MG", marca: "Primeira Mão" },
      { nome_empresa: "OFF ROAD JOÃO NAVES - PRIMEIRA MÃO", cnpj: "03.267.961/0003-17", grupo_empresarial: "Saga", uf: "MG", marca: "Primeira Mão" },
      { nome_empresa: "AFONSO PENA - PRIMEIRA MÃO", cnpj: "03.267.961/0004-06", grupo_empresarial: "Saga", uf: "MG", marca: "Primeira Mão" },
      { nome_empresa: "SAGA VOLKSWAGEN UDI", cnpj: "03.947.095/0001-43", grupo_empresarial: "Saga", uf: "MG", marca: "Volkswagem" },
      { nome_empresa: "Saga Toyota T7", cnpj: "05.471.879/0001-73", grupo_empresarial: "Saga", uf: "GO", marca: "Toyota" },
      { nome_empresa: "Saga Toyota Anápolis", cnpj: "05.471.879/0002-54", grupo_empresarial: "Saga", uf: "GO", marca: "Toyota" },
      { nome_empresa: "Saga Toyota Buriti", cnpj: "05.471.879/0003-35", grupo_empresarial: "Saga", uf: "GO", marca: "Toyota" },
      { nome_empresa: "Saga Toyota Colorado", cnpj: "05.471.879/0004-16", grupo_empresarial: "Saga", uf: "DF", marca: "Toyota" },
      { nome_empresa: "Saga Toyota Asa Norte", cnpj: "05.471.879/0005-05", grupo_empresarial: "Saga", uf: "DF", marca: "Toyota" },
      { nome_empresa: "Saga Volkswagen PVH", cnpj: "08.748.749/0001-23", grupo_empresarial: "Saga", uf: "RO", marca: "Volkswagem" },
      { nome_empresa: "PREMIUM PVH - PRIMEIRA MÃO", cnpj: "08.748.749/0002-04", grupo_empresarial: "Saga", uf: "RO", marca: "Primeira Mão" },
      { nome_empresa: "Saga Repasse RO", cnpj: "08.748.749/0003-95", grupo_empresarial: "Saga", uf: "RO", marca: "Repasse" },
      { nome_empresa: "BR PVH - PRIMEIRA MÃO", cnpj: "08.748.749/0004-76", grupo_empresarial: "Saga", uf: "RO", marca: "Primeira Mão" },
      { nome_empresa: "DIGITAL PVH - PRIMEIRA MÃO", cnpj: "08.748.749/0006-38", grupo_empresarial: "Saga", uf: "RO", marca: "Primeira Mão" },
      { nome_empresa: "Saga Renault VGD", cnpj: "08.860.168/0001-89", grupo_empresarial: "Saga", uf: "MT", marca: "Renault" },
      { nome_empresa: "CUIABÁ - PRIMEIRA MÃO", cnpj: "08.860.168/0002-60", grupo_empresarial: "Saga", uf: "MT", marca: "Primeira Mão" },
      { nome_empresa: "OFF ROAD VGD - PRIMEIRA MÃO", cnpj: "08.860.168/0004-21", grupo_empresarial: "Saga", uf: "MT", marca: "Primeira Mão" },
      { nome_empresa: "Saga Renault Cuiabá", cnpj: "08.860.168/0006-93", grupo_empresarial: "Saga", uf: "MT", marca: "Renault" },
      { nome_empresa: "FERNANDO CORREA - PRIMEIRA MÃO", cnpj: "08.860.168/0008-55", grupo_empresarial: "Saga", uf: "MT", marca: "Primeira Mão" },
      { nome_empresa: "GAMA - PRIMEIRA MÃO", cnpj: "09.102.044/0008-73", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "TAGUATINGA - PRIMEIRA MÃO", cnpj: "09.102.044/0009-54", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "JARDIM BOTÂNICO - PRIMEIRA MÃO", cnpj: "09.102.044/0010-98", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "ASA NORTE - PRIMEIRA MÃO", cnpj: "09.102.044/0011-79", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "BSB - PRIMEIRA MÃO", cnpj: "09.102.044/0012-50", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "CONTAINER - PRIMEIRA MÃO", cnpj: "09.102.044/0014-11", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "COLORADO - PRIMEIRA MÃO", cnpj: "09.102.044/0015-00", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "SCIA - PRIMEIRA MÃO", cnpj: "09.102.044/0017-64", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "VALPARAISO - PRIMEIRA MÃO", cnpj: "09.102.044/0018-45", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "SADIF - PRIMEIRA MÃO", cnpj: "09.102.044/0019-26", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "OFF ROAD T7 - PRIMEIRA MÃO", cnpj: "09.102.044/0020-60", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "OFF ROAD 85 - PRIMEIRA MÃO", cnpj: "09.102.044/0022-21", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "T7 - PRIMEIRA MÃO", cnpj: "09.102.044/0023-02", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "ANÁPOLIS - PRIMEIRA MÃO", cnpj: "09.102.044/0025-74", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "BURITI - PRIMEIRA MÃO", cnpj: "09.102.044/0026-55", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "CIDADE JARDIM - PRIMEIRA MÃO", cnpj: "09.102.044/0028-17", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "PASSEIO DAS ÁGUAS - PRIMEIRA MÃO", cnpj: "09.102.044/0029-06", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "GALPÃO - PRIMEIRAMÃO GO", cnpj: "09.102.044/0030-31", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "Fiat Sadif - SIA", cnpj: "09.348.217/0001-61", grupo_empresarial: "Saga", uf: "DF", marca: "Fiat" },
      { nome_empresa: "Fiat Sadif - Gama", cnpj: "09.348.217/0003-23", grupo_empresarial: "Saga", uf: "DF", marca: "Fiat" },
      { nome_empresa: "Fiat Sadif - Park Sul", cnpj: "09.348.217/0004-04", grupo_empresarial: "Saga", uf: "DF", marca: "Fiat" },
      { nome_empresa: "Fiat Sadif - Colorado", cnpj: "09.348.217/0006-76", grupo_empresarial: "Saga", uf: "DF", marca: "Fiat" },
      { nome_empresa: "Gramarca Pantanal", cnpj: "10.084.986/0001-89", grupo_empresarial: "Saga", uf: "MT", marca: "GM" },
      { nome_empresa: "Saga BYD GO", cnpj: "10.272.533/0001-86", grupo_empresarial: "Saga", uf: "GO", marca: "BYD" },
      { nome_empresa: "Saga BYD BSB", cnpj: "10.272.533/0002-67", grupo_empresarial: "Saga", uf: "DF", marca: "BYD" },
      { nome_empresa: "Saga BYD Aeroporto", cnpj: "10.272.533/0004-29", grupo_empresarial: "Saga", uf: "DF", marca: "BYD" },
      { nome_empresa: "Saga BYD Taguatinga", cnpj: "10.272.533/0005-00", grupo_empresarial: "Saga", uf: "DF", marca: "BYD" },
      { nome_empresa: "SAGA FRANCE", cnpj: "11.458.618/0001-16", grupo_empresarial: "Saga", uf: "MG", marca: "Peugeot/ Citroen" },
      { nome_empresa: "Nissan Japan - Colorado", cnpj: "11.727.257/0001-66", grupo_empresarial: "Saga", uf: "DF", marca: "Nissan" },
      { nome_empresa: "Nissan Japan - Taguatinga", cnpj: "11.727.257/0002-47", grupo_empresarial: "Saga", uf: "DF", marca: "Nissan" },
      { nome_empresa: "Saga Nissan BR153", cnpj: "11.727.257/0003-28", grupo_empresarial: "Saga", uf: "GO", marca: "Nissan" },
      { nome_empresa: "Saga Nissan Rio Verde", cnpj: "11.727.257/0004-09", grupo_empresarial: "Saga", uf: "GO", marca: "Nissan" },
      { nome_empresa: "Saga Nissan Anápolis", cnpj: "11.727.257/0005-90", grupo_empresarial: "Saga", uf: "GO", marca: "Nissan" },
      { nome_empresa: "Saga Nissan 85", cnpj: "11.727.257/0006-70", grupo_empresarial: "Saga", uf: "GO", marca: "Nissan" },
      { nome_empresa: "Saga Nissan VGD", cnpj: "11.748.698/0001-44", grupo_empresarial: "Saga", uf: "MT", marca: "Nissan" },
      { nome_empresa: "Saga Nissan CBA", cnpj: "11.748.698/0002-25", grupo_empresarial: "Saga", uf: "MT", marca: "Nissan" },
      { nome_empresa: "Saga Nissan Tangará", cnpj: "11.748.698/0003-06", grupo_empresarial: "Saga", uf: "MT", marca: "Nissan" },
      { nome_empresa: "Saga Hyundai HMB T9", cnpj: "12.657.826/0005-30", grupo_empresarial: "Saga", uf: "GO", marca: "Hyundai" },
      { nome_empresa: "Saga Hyundai HMB Cidade Jardim", cnpj: "12.657.826/0006-11", grupo_empresarial: "Saga", uf: "GO", marca: "Hyundai" },
      { nome_empresa: "Saga Hyundai HMB Anápolis", cnpj: "12.657.826/0007-00", grupo_empresarial: "Saga", uf: "GO", marca: "Hyundai" },
      { nome_empresa: "Saga Hyundai HMB Taguatinga", cnpj: "12.657.826/0008-83", grupo_empresarial: "Saga", uf: "DF", marca: "Hyundai" },
      { nome_empresa: "Saga Hyundai HMB SIA", cnpj: "12.657.826/0009-64", grupo_empresarial: "Saga", uf: "DF", marca: "Hyundai" },
      { nome_empresa: "PRIMEIRA MÃO OUTLET DF", cnpj: "13.243.978/0001-26", grupo_empresarial: "Saga", uf: "DF", marca: "Primeira Mão" },
      { nome_empresa: "Saga KIA BSB", cnpj: "13.243.978/0002-07", grupo_empresarial: "Saga", uf: "DF", marca: "Kia" },
      { nome_empresa: "BMW MOTORRAD - PRIMEIRA MÃO", cnpj: "14.007.304/0001-95", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "Saga Tudo Chevrolet Mutirão", cnpj: "14.234.954/0001-73", grupo_empresarial: "Saga", uf: "GO", marca: "GM" },
      { nome_empresa: "Saga Tudo Chevrolet Buriti", cnpj: "14.234.954/0002-54", grupo_empresarial: "Saga", uf: "GO", marca: "GM" },
      { nome_empresa: "Saga Assinatura GO", cnpj: "16.611.298/0001-06", grupo_empresarial: "Saga", uf: "GO", marca: "Assinatura" },
      { nome_empresa: "Saga Jeep BR153", cnpj: "19.945.014/0001-06", grupo_empresarial: "Saga", uf: "GO", marca: "Jeep" },
      { nome_empresa: "Saga Jeep Anápolis", cnpj: "19.945.014/0002-97", grupo_empresarial: "Saga", uf: "GO", marca: "Jeep" },
      { nome_empresa: "Saga Jeep T9", cnpj: "19.945.014/0003-78", grupo_empresarial: "Saga", uf: "GO", marca: "Jeep" },
      { nome_empresa: "SAGA RAM House", cnpj: "19.945.014/0004-59", grupo_empresarial: "Saga", uf: "GO", marca: "RAM" },
      { nome_empresa: "SAGA JEEP COLORADO", cnpj: "19.945.014/0005-30", grupo_empresarial: "Saga", uf: "DF", marca: "Jeep" },
      { nome_empresa: "SAGA JEEP ASA NORTE", cnpj: "19.945.014/0006-10", grupo_empresarial: "Saga", uf: "DF", marca: "Jeep" },
      { nome_empresa: "SAGA JEEP TAGUATINGA", cnpj: "19.945.014/0007-00", grupo_empresarial: "Saga", uf: "DF", marca: "Jeep" },
      { nome_empresa: "Saga BMW GO", cnpj: "20.374.616/0001-30", grupo_empresarial: "Saga", uf: "GO", marca: "BMW" },
      { nome_empresa: "Saga BMW Motorrad", cnpj: "20.374.616/0002-10", grupo_empresarial: "Saga", uf: "GO", marca: "BMW Motorrad" },
      { nome_empresa: "PREMIUM GO - PRIMEIRA MÃO", cnpj: "20.374.616/0005-63", grupo_empresarial: "Saga", uf: "GO", marca: "Primeira Mão" },
      { nome_empresa: "Gramarca - VGD", cnpj: "20.379.987/0001-04", grupo_empresarial: "Saga", uf: "MT", marca: "GM" },
      { nome_empresa: "GRAMARCA CÁCERES", cnpj: "20.379.987/0003-76", grupo_empresarial: "Saga", uf: "MT", marca: "GM" },
      { nome_empresa: "Gramarca - CBA", cnpj: "20.379.987/0006-19", grupo_empresarial: "Saga", uf: "MT", marca: "GM" },
      { nome_empresa: "CONTAINER GRAMARCA - CBA", cnpj: "20.379.987/0009-61", grupo_empresarial: "Saga", uf: "MT", marca: "GM" },
      { nome_empresa: "Saga Jeep Michigan", cnpj: "21.214.513/0001-75", grupo_empresarial: "Saga", uf: "MG", marca: "Jeep" },
      { nome_empresa: "Saga Land Rover MT", cnpj: "21.333.642/0001-82", grupo_empresarial: "Saga", uf: "MT", marca: "Land Rover/ Jaguar" },
      { nome_empresa: "Saga BYD CBA", cnpj: "21.333.642/0002-63", grupo_empresarial: "Saga", uf: "MT", marca: "BYD" },
      { nome_empresa: "BYD - CIDADE JARDIM", cnpj: "21.333.642/0003-44", grupo_empresarial: "Saga", uf: "GO", marca: "BYD" },
      { nome_empresa: "Saga BYD Rondonópolis", cnpj: "21.333.642/0004-25", grupo_empresarial: "Saga", uf: "MT", marca: "BYD" },
      { nome_empresa: "Saga Mitsubishi Rondonópolis", cnpj: "21.333.642/0004-26", grupo_empresarial: "Saga", uf: "MT", marca: "Mitsubishi" },
      { nome_empresa: "Saga BYD VGD", cnpj: "21.333.642/0005-06", grupo_empresarial: "Saga", uf: "MT", marca: "BYD" },
      { nome_empresa: "Saga BYD Sinop", cnpj: "21.333.642/9999-99", grupo_empresarial: "Saga", uf: "MT", marca: "BYD" },
      { nome_empresa: "Saga Hyundai HMB PVH", cnpj: "21.428.039/0001-84", grupo_empresarial: "Saga", uf: "RO", marca: "Hyundai" },
      { nome_empresa: "Saga Hyundai HMB VGD", cnpj: "22.280.413/0001-00", grupo_empresarial: "Saga", uf: "MT", marca: "Hyundai" },
      { nome_empresa: "Saga Hyundai HMB Pantanal", cnpj: "22.280.413/0002-90", grupo_empresarial: "Saga", uf: "MT", marca: "Hyundai" },
      { nome_empresa: "Saga Moove GO", cnpj: "26.046.380/0001-99", grupo_empresarial: "Saga", uf: "GO", marca: "Bicicletas" },
      { nome_empresa: "Saga Triumph", cnpj: "26.343.161/0001-71", grupo_empresarial: "Saga", uf: "GO", marca: "Triumph" },
      { nome_empresa: "Saga Renault PVH", cnpj: "30.903.216/0001-28", grupo_empresarial: "Saga", uf: "RO", marca: "Renault" },
      { nome_empresa: "COXIPÓ - PRIMEIRA MÃO", cnpj: "32.108.001/0001-40", grupo_empresarial: "Saga", uf: "MT", marca: "Primeira Mão" },
      { nome_empresa: "Saga Moove SP", cnpj: "33.863.628/0001-70", grupo_empresarial: "Saga", uf: "SP", marca: "Bicicletas" },
      { nome_empresa: "Saga RAM UDI", cnpj: "38.461.145/0001-62", grupo_empresarial: "Saga", uf: "MG", marca: "RAM" },
      { nome_empresa: "Saga Assinatura MG", cnpj: "45.616.451/0001-96", grupo_empresarial: "Saga", uf: "MG", marca: "Assinatura" },
      { nome_empresa: "Saga BYD PVH", cnpj: "50.071.859/0001-60", grupo_empresarial: "Saga", uf: "RO", marca: "BYD" },
      { nome_empresa: "Saga RAM Anápolis", cnpj: "51.423.528/0001-04", grupo_empresarial: "Saga", uf: "GO", marca: "RAM" },
      { nome_empresa: "Saga Assinatura DF", cnpj: "53.380.234/0001-78", grupo_empresarial: "Saga", uf: "DF", marca: "Assinatura" },
      { nome_empresa: "Saga RAM BR153", cnpj: "58.129.819/0001-33", grupo_empresarial: "Saga", uf: "GO", marca: "RAM" },
      { nome_empresa: "Saga Mitsubishi Cuiabá", cnpj: "74.150.889/0001-20", grupo_empresarial: "Saga", uf: "MT", marca: "Mitsubishi" },
      { nome_empresa: "PREMIUM MT - PRIMEIRA MÃO", cnpj: "76.189.427/0001-41", grupo_empresarial: "Saga", uf: "MT", marca: "Primeira Mão" },
      { nome_empresa: "Saga Assinatura MT", cnpj: "78.675.918/0001-28", grupo_empresarial: "Saga", uf: "MT", marca: "Assinatura" },
      { nome_empresa: "Saga Toyota Goianésia", cnpj: "86.761.653/0001-09", grupo_empresarial: "Saga", uf: "GO", marca: "Toyota" }
    ]

    // Processar cada empresa individualmente
    for (const empresa of empresasList) {
      try {
        // Verificar se a empresa já existe pelo CNPJ
        const { data: existingEmpresa } = await supabaseClient
          .from('empresas')
          .select('id, nome_empresa')
          .eq('cnpj', empresa.cnpj)
          .maybeSingle()

        if (existingEmpresa) {
          results.details.push({
            cnpj: empresa.cnpj,
            nome: empresa.nome_empresa,
            status: 'skipped',
            reason: 'Empresa já existe'
          })
          continue
        }

        // Tentar inserir a empresa
        const { error: insertError } = await supabaseClient
          .from('empresas')
          .insert([{
            nome_empresa: empresa.nome_empresa,
            cnpj: empresa.cnpj,
            grupo_empresarial: empresa.grupo_empresarial,
            uf: empresa.uf,
            marca: empresa.marca
          }])

        if (insertError) {
          results.errors++
          results.details.push({
            cnpj: empresa.cnpj,
            nome: empresa.nome_empresa,
            status: 'error',
            reason: insertError.message
          })
        } else {
          results.success++
          results.details.push({
            cnpj: empresa.cnpj,
            nome: empresa.nome_empresa,
            status: 'success'
          })
        }
      } catch (error) {
        results.errors++
        results.details.push({
          cnpj: empresa.cnpj,
          nome: empresa.nome_empresa,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})