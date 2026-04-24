import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAIN = '@gruposaga.com.br';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Cleaning up users with invalid domains...');
    
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

    // Get all users
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Erro ao listar usuários: ${listError.message}`);
    }

    const invalidUsers: Array<{ id: string; email: string }> = [];
    const deletedUsers: Array<{ id: string; email: string; status: string }> = [];
    const errors: Array<{ id: string; email: string; error: string }> = [];

    // Find users with invalid domains
    for (const u of usersData.users) {
      const email = u.email?.toLowerCase() || '';
      if (email && !email.endsWith(ALLOWED_DOMAIN.toLowerCase())) {
        invalidUsers.push({ id: u.id, email: email });
      }
    }

    console.log(`Found ${invalidUsers.length} users with invalid domains`);

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
        },
        deleted: deletedUsers,
        errors: errors,
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
