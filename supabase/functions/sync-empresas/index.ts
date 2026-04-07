import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmpresaCSV {
  cnpj: string;
  nome: string;
  marca: string;
  uf: string;
  crm_id: string;
  cidade?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting empresas sync from file...');
    
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação não fornecido');
    }

    // Parse request body
    const body = await req.json();
    const empresasCSV: EmpresaCSV[] = body.empresas;

    if (!empresasCSV || !Array.isArray(empresasCSV) || empresasCSV.length === 0) {
      throw new Error('Nenhuma empresa fornecida para sincronização');
    }

    console.log(`Received ${empresasCSV.length} empresas from file`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tipo_acesso')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.tipo_acesso !== 'Administrador') {
      throw new Error('Apenas administradores podem sincronizar empresas');
    }

    // Get current empresas with their names
    const { data: currentEmpresas, error: fetchError } = await supabase
      .from('empresas')
      .select('id, cnpj, crm_id, nome_empresa');

    if (fetchError) {
      throw new Error(`Erro ao buscar empresas: ${fetchError.message}`);
    }

    console.log(`Found ${currentEmpresas?.length || 0} existing empresas in database`);

    // Build maps for comparison - using crm_id as the main identifier
    const csvByCrmId = new Map(empresasCSV.map(e => [e.crm_id, e]));
    const currentByCrmId = new Map(currentEmpresas?.map(e => [e.crm_id, e]) || []);

    const results = {
      added: [] as Array<{ nome: string; crm_id: string; status: string }>,
      updated: [] as Array<{ nome: string; crm_id: string; status: string }>,
      skipped: [] as Array<{ crm_id: string; nome: string }>,
      errors: [] as Array<{ nome?: string; crm_id?: string; error: string }>,
    };

    // Log empresas not in CSV (no deletion)
    for (const [crm_id, empresa] of currentByCrmId) {
      if (crm_id && !csvByCrmId.has(crm_id)) {
        results.skipped.push({ crm_id: crm_id || '', nome: empresa.nome_empresa || 'N/A' });
      }
    }

    // Add or update empresas from CSV
    for (const empresa of empresasCSV) {
      if (!empresa.crm_id) {
        results.errors.push({ nome: empresa.nome, error: 'CRM ID não informado' });
        continue;
      }

      const existingByCrmId = currentByCrmId.get(empresa.crm_id);

      if (existingByCrmId) {
        // Update existing
        console.log(`Updating empresa ${empresa.nome}...`);
        const { error: updateError } = await supabase
          .from('empresas')
          .update({
            nome_empresa: empresa.nome,
            cnpj: empresa.cnpj,
            marca: empresa.marca,
            uf: empresa.uf,
            cidade: empresa.cidade || null,
            grupo_empresarial: 'SAGA',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingByCrmId.id);

        if (updateError) {
          results.errors.push({ nome: empresa.nome, crm_id: empresa.crm_id, error: updateError.message });
        } else {
          results.updated.push({ nome: empresa.nome, crm_id: empresa.crm_id, status: 'updated' });
        }
      } else {
        // Insert new
        console.log(`Adding empresa ${empresa.nome}...`);
        const { error: insertError } = await supabase
          .from('empresas')
          .insert({
            nome_empresa: empresa.nome,
            cnpj: empresa.cnpj,
            marca: empresa.marca,
            uf: empresa.uf,
            cidade: empresa.cidade || null,
            crm_id: empresa.crm_id,
            grupo_empresarial: 'SAGA',
          });

        if (insertError) {
          results.errors.push({ nome: empresa.nome, crm_id: empresa.crm_id, error: insertError.message });
        } else {
          results.added.push({ nome: empresa.nome, crm_id: empresa.crm_id, status: 'added' });
        }
      }
    }

    console.log('Sync completed:', {
      added: results.added.length,
      updated: results.updated.length,
      deleted: results.deleted.length,
      errors: results.errors.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          added: results.added.length,
          updated: results.updated.length,
          deleted: results.deleted.length,
          errors: results.errors.length,
        },
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-empresas:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
