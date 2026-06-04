import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Cleaning up users with invalid domains (allowlist-based)...');
    
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tipo_acesso')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.tipo_acesso !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load allowlist of permitted domains (active only)
    const { data: domainsData, error: domainsError } = await supabase
      .from('allowed_login_domains')
      .select('dominio')
      .eq('ativo', true);

    if (domainsError) {
      throw new Error(`Erro ao carregar allowlist de domínios: ${domainsError.message}`);
    }

    const allowedDomains = (domainsData || [])
      .map((d: any) => String(d.dominio).toLowerCase());

    if (allowedDomains.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum domínio permitido configurado — abortando para segurança' }),
        { status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Allowed domains:', allowedDomains);

    // Load profiles to know who is_external / is_active (dupla proteção)
    const { data: profilesProtect } = await supabase
      .from('profiles')
      .select('id, is_external, is_active');
    const protectMap = new Map<string, { is_external: boolean; is_active: boolean }>();
    (profilesProtect || []).forEach((p: any) => {
      protectMap.set(p.id, {
        is_external: !!p.is_external,
        is_active: p.is_active !== false,
      });
    });

    // Get all users
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Erro ao listar usuários: ${listError.message}`);
    }

    const invalidUsers: Array<{ id: string; email: string }> = [];
    const deletedUsers: Array<{ id: string; email: string; status: string }> = [];
    const errors: Array<{ id: string; email: string; error: string }> = [];
    const skipped: Array<{ id: string; email: string; reason: string }> = [];

    // Find users with invalid domains (and SKIP terceiros/ativos por segurança)
    for (const u of usersData.users) {
      const email = u.email?.toLowerCase() || '';
      if (!email) continue;

      const emailDomain = email.split('@')[1] || '';
      const isAllowed = allowedDomains.some(d => emailDomain === d);
      if (isAllowed) continue;

      // Dupla proteção: pular qualquer usuário marcado como terceiro OU ativo
      const protect = protectMap.get(u.id);
      if (protect?.is_external) {
        skipped.push({ id: u.id, email, reason: 'is_external=true (terceiro protegido)' });
        continue;
      }
      if (protect?.is_active) {
        skipped.push({ id: u.id, email, reason: 'is_active=true (ativo)' });
        continue;
      }

      invalidUsers.push({ id: u.id, email });
    }

    console.log(`Found ${invalidUsers.length} users with invalid domains`);
    console.log(`Skipped ${skipped.length} users (protected by is_external/is_active)`);

    // Delete invalid users
    for (const invalidUser of invalidUsers) {
      try {
        console.log(`Deleting user: ${invalidUser.email}`);
        
        // First delete from profiles table
        await supabase
          .from('profiles')
          .delete()
          .eq('id', invalidUser.id);

        // Then delete from auth.users
        const { error: deleteError } = await supabase.auth.admin.deleteUser(invalidUser.id);
        
        if (deleteError) {
          errors.push({ 
            id: invalidUser.id, 
            email: invalidUser.email, 
            error: deleteError.message 
          });
        } else {
          deletedUsers.push({ 
            id: invalidUser.id, 
            email: invalidUser.email, 
            status: 'deleted' 
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push({ 
          id: invalidUser.id, 
          email: invalidUser.email, 
          error: message 
        });
      }
    }

    console.log('Cleanup completed:', { deleted: deletedUsers.length, errors: errors.length });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_invalid: invalidUsers.length,
          deleted: deletedUsers.length,
          errors: errors.length,
          skipped: skipped.length,
        },
        allowed_domains: allowedDomains,
        deleted: deletedUsers,
        errors: errors,
        skipped: skipped,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-invalid-users:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
