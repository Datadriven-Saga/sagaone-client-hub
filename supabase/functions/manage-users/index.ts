import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create regular client for user validation
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get the JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // Verify the user and their permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid token');
    }

    // Check if user can manage users or is a company owner
    const { data: canManage, error: permError } = await supabase
      .rpc('can_manage_users', { user_id: user.id });

    // If not admin/TI, check if user is a company owner (Proprietário)
    let ownedCompanies = [];
    if (permError || !canManage) {
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tipo_acesso')
        .eq('id', user.id)
        .single();

      if (profileError || userProfile?.tipo_acesso !== 'Proprietário') {
        throw new Error('Insufficient permissions to manage users');
      }

      // Get owned companies for the proprietário
      const { data: ownedCompaniesData, error: ownedError } = await supabase
        .rpc('get_owned_companies', { user_id: user.id });

      if (ownedError) {
        throw new Error('Error retrieving owned companies');
      }

      ownedCompanies = ownedCompaniesData?.map((row: any) => row.empresa_id) || [];
      
      if (ownedCompanies.length === 0) {
        throw new Error('No companies owned by this user');
      }
    }

    const { action, ...payload } = await req.json();

    console.log('User management action:', action, 'by user:', user.id);

    switch (action) {
      case 'list_users': {
        // Use admin client to bypass RLS for profile fetching
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          throw profilesError;
        }

        console.log('Found profiles:', profiles?.length || 0);

        // Get user emails from auth and companies for each user
        const profilesWithDetails = await Promise.all(
          (profiles || []).map(async (profile) => {
            try {
              // Get user email from auth
              const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
              
              // Get user companies
              const { data: userEmpresas, error: empresasError } = await supabaseAdmin
                .from('user_empresas')
                .select(`
                  empresa_id,
                  is_ativa,
                  empresas!inner (
                    id,
                    nome_empresa
                  )
                `)
                .eq('user_id', profile.id);

              if (empresasError) {
                console.error('Error fetching user companies for user:', profile.id, empresasError);
              }

              const companies = userEmpresas?.map(ue => ue.empresas).filter(Boolean) || [];
              
              console.log(`User ${profile.id} has ${companies.length} companies`);

              if (userError) {
                console.error('Error fetching user data for:', profile.id, userError);
                return {
                  ...profile,
                  email: 'Email não disponível',
                  empresas: companies
                };
              }

              return {
                ...profile,
                email: userData?.user?.email || 'Email não disponível',
                empresas: companies
              };
            } catch (error) {
              console.error('Error fetching user details for profile:', profile.id, error);
              return {
                ...profile,
                email: 'Email não disponível',
                empresas: []
              };
            }
          })
        );

        console.log('Profiles with details:', profilesWithDetails.length);

        return new Response(
          JSON.stringify({ users: profilesWithDetails }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_user': {
        const { email, password, nome_completo, tipo_acesso, departamento, celular, cpf, status, empresas } = payload;

        // If user is not admin/TI, validate they can only create users in their owned companies
        if (!canManage && ownedCompanies.length > 0) {
          const invalidCompanies = empresas.filter((empresaId: string) => !ownedCompanies.includes(empresaId));
          if (invalidCompanies.length > 0) {
            throw new Error('You can only create users in companies you own');
          }
          
          // Proprietários cannot create other Proprietários or Admins/TI
          if (['Proprietário', 'Administrador', 'TI'].includes(tipo_acesso)) {
            throw new Error('Proprietários cannot create users with Proprietário, Administrador or TI access');
          }
        }

        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (checkError) {
          console.error('Error checking existing users:', checkError);
          throw new Error('Erro ao verificar usuários existentes');
        }

        const userExists = existingUser.users?.some(user => user.email === email);
        
        if (userExists) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Um usuário com este email já existe no sistema'
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Create user in auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            nome_completo,
            full_name: nome_completo
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          // Get user's empresa_id from current admin user or use first owned company for proprietários
          let defaultEmpresaId;
          
          if (canManage) {
            // Admin/TI users - get their empresa_id
            const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
              .from('profiles')
              .select('empresa_id')
              .eq('id', user.id)
              .single();

            defaultEmpresaId = adminProfile?.empresa_id || '00000000-0000-0000-0000-000000000001';
          } else {
            // Proprietários - use first owned company
            defaultEmpresaId = ownedCompanies[0] || '00000000-0000-0000-0000-000000000001';
          }

          // Update the profile created by trigger using admin client
          // Use null instead of empty string for cpf to avoid unique constraint violations
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
              tipo_acesso,
              departamento,
              celular: celular || null,
              cpf: cpf || null,
              status,
              empresa_id: defaultEmpresaId
            })
            .eq('id', authData.user.id);

          if (updateError) {
            console.error('Error updating profile:', updateError);
            // Try to clean up the created user
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw updateError;
          }

          // Create company relationships
          if (empresas && empresas.length > 0) {
            const userEmpresasData = empresas.map((empresaId: string, index: number) => ({
              user_id: authData.user.id,
              empresa_id: empresaId,
              is_ativa: index === 0 // First company is active by default
            }));

            const { error: userEmpresasError } = await supabaseAdmin
              .from('user_empresas')
              .insert(userEmpresasData);

            if (userEmpresasError) {
              console.error('Error creating user-company relationships:', userEmpresasError);
              // Try to clean up the created user
              await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
              throw userEmpresasError;
            }
          }

          console.log('User created successfully:', authData.user.id);

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Usuário criado com sucesso',
              user_id: authData.user.id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        throw new Error('Failed to create user');
      }

      case 'delete_user': {
        const { user_id } = payload;

        if (!user_id) {
          throw new Error('User ID is required');
        }

        // Delete user from auth (this will cascade to profiles table)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

        if (deleteError) throw deleteError;

        console.log('User deleted successfully:', user_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Usuário excluído com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_user': {
        const { user_id, nome_completo, tipo_acesso, departamento, celular, cpf, status, empresas, password } = payload;

        if (!user_id) {
          throw new Error('User ID is required');
        }

        // If user is not admin/TI, validate they can only update users in their owned companies
        if (!canManage && ownedCompanies.length > 0) {
          // Check if the user being updated belongs to owned companies
          const { data: userCompanies, error: userCompaniesError } = await supabaseAdmin
            .from('user_empresas')
            .select('empresa_id')
            .eq('user_id', user_id);

          if (userCompaniesError) {
            throw new Error('Error checking user companies');
          }

          const userCompanyIds = userCompanies?.map(uc => uc.empresa_id) || [];
          const hasPermission = userCompanyIds.some(companyId => ownedCompanies.includes(companyId));

          if (!hasPermission) {
            throw new Error('You can only update users in companies you own');
          }

          // Proprietários cannot modify access types to restricted levels
          if (['Proprietário', 'Administrador', 'TI'].includes(tipo_acesso)) {
            throw new Error('Proprietários cannot set users as Proprietário, Administrador or TI');
          }

          // Validate new companies are owned
          if (empresas) {
            const invalidCompanies = empresas.filter((empresaId: string) => !ownedCompanies.includes(empresaId));
            if (invalidCompanies.length > 0) {
              throw new Error('You can only assign users to companies you own');
            }
          }
        }

        // Update profile using admin client
        // Use null instead of empty string for cpf to avoid unique constraint violations
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            nome_completo,
            tipo_acesso,
            departamento,
            celular: celular || null,
            cpf: cpf || null,
            status
          })
          .eq('id', user_id);

        if (updateError) throw updateError;

        // Update company relationships if provided
        if (empresas && empresas.length > 0) {
          // Delete existing relationships
          const { error: deleteError } = await supabaseAdmin
            .from('user_empresas')
            .delete()
            .eq('user_id', user_id);

          if (deleteError) {
            console.error('Error deleting user company relationships:', deleteError);
            throw deleteError;
          }

          // Create new relationships
          const userEmpresasData = empresas.map((empresaId: string, index: number) => ({
            user_id: user_id,
            empresa_id: empresaId,
            is_ativa: index === 0 // First company is active by default
          }));

          const { error: insertError } = await supabaseAdmin
            .from('user_empresas')
            .insert(userEmpresasData);

          if (insertError) {
            console.error('Error creating user company relationships:', insertError);
            throw insertError;
          }
        }

        // Update user metadata and password if provided
        const authUpdateData: any = {
          user_metadata: {
            nome_completo,
            full_name: nome_completo
          }
        };

        // Include password update if provided
        if (password && password.trim() !== '') {
          authUpdateData.password = password;
        }

        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          authUpdateData
        );

        if (authUpdateError) {
          console.error('Error updating auth metadata:', authUpdateError);
          // Don't throw error here as profile update was successful
        }

        console.log('User updated successfully:', user_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Usuário atualizado com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in manage-users function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false
      }),
      {
        status: errorMessage.includes('Insufficient permissions') ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});