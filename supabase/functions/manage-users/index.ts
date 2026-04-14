import { createClient } from "npm:@supabase/supabase-js@2.56.1";


// Allowed origins for CORS
const allowedOrigins = [
  'https://automatemaia.sagadatadriven.com.br',
  'https://lovable.dev',
  'https://7bc578c3-4b3d-4f33-830e-6157c828c9e5.lovableproject.com',
  'https://id-preview--7bc578c3-4b3d-4f33-830e-6157c828c9e5.lovable.app',
  'https://maia.sagadatadriven.com.br',
  'https://sagaone.sagadatadriven.com.br',
  'https://sagaone-client-hub.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  
  // Check if origin is in the allowed list or matches lovable.app pattern
  const isLovableOrigin = origin.includes('.lovable.app') || origin.includes('.lovableproject.com') || origin.includes('lovable.dev');
  const isAllowed = isLovableOrigin || allowedOrigins.some(allowed => origin === allowed);
  
  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
Deno.serve(async (req: Request) => {
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

    // Check if user can manage users or is a company owner or is a manager (Gerente)
    const { data: canManage, error: permError } = await supabase
      .rpc('can_manage_users', { user_id: user.id });

    // Get user profile to check role and permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('tipo_acesso')
      .eq('id', user.id)
      .single();
    
    const userTipoAcesso = userProfile?.tipo_acesso || '';
    const isAdmin = userTipoAcesso === 'Administrador';
    const isGerente = userTipoAcesso === 'Gerente de Leads' || userTipoAcesso === 'Gerente de Loja';
    
    // If not admin/TI, check if user is a company owner (Proprietário) or manager (Gerente)
    let ownedCompanies: string[] = [];
    let gerenteCompanies: string[] = [];
    
    if (permError || !canManage) {
      if (profileError) {
        throw new Error('Error retrieving user profile');
      }
      
      // Allow Gerente de Leads and Gerente de Loja to access with restrictions
      if (isGerente) {
        // Get companies the manager has access to
        const { data: gerenteCompaniesData, error: gerenteCompaniesError } = await supabaseAdmin
          .from('user_empresas')
          .select('empresa_id')
          .eq('user_id', user.id);
        
        if (gerenteCompaniesError) {
          throw new Error('Error retrieving manager companies');
        }
        
        gerenteCompanies = gerenteCompaniesData?.map((row: any) => row.empresa_id) || [];
        
        if (gerenteCompanies.length === 0) {
          throw new Error('Manager has no assigned companies');
        }
      } else if (userProfile?.tipo_acesso === 'Proprietário') {
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
      } else {
        throw new Error('Insufficient permissions to manage users');
      }
    }

    const { action, ...payload } = await req.json();

    console.log('User management action:', action, 'by user:', user.id);

    switch (action) {
      case 'list_users': {
        // Build tipo_acesso filter for Gerentes
        const tipoAcessoFilter = (isGerente && !canManage)
          ? ['SDR', 'Vendedor', 'Recepcionista', 'CRM', 'Gerente de Leads', 'Gerente de Loja']
          : null;

        // === PRIMARY: Use RPC (fast, reliable, no auth API dependency) ===
        let profilesWithDetails: any[] = [];
        let usedRpc = false;

        try {
          const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_users_with_email', {
            p_tipo_acesso_filter: tipoAcessoFilter,
          });

          if (rpcError) throw rpcError;

          profilesWithDetails = (rpcData || []).map((row: any) => ({
            ...row,
            empresas: [], // Will be populated below
          }));
          usedRpc = true;
          console.log('RPC get_users_with_email returned:', profilesWithDetails.length, 'profiles');
        } catch (rpcErr) {
          console.warn('RPC get_users_with_email failed, falling back to listUsers:', rpcErr);
        }

        // === FALLBACK: Legacy listUsers approach ===
        if (!usedRpc) {
          let profilesQuery = supabaseAdmin
            .from('profiles')
            .select('id, nome_completo, tipo_acesso, departamento, celular, cpf, status, empresa_id, created_at')
            .order('created_at', { ascending: false });

          if (tipoAcessoFilter) {
            profilesQuery = profilesQuery.in('tipo_acesso', tipoAcessoFilter);
          }

          const { data: profiles, error: profilesError } = await profilesQuery.limit(200);
          if (profilesError) throw profilesError;

          console.log('Fallback: Found profiles:', profiles?.length || 0);

          if (!profiles || profiles.length === 0) {
            return new Response(
              JSON.stringify({ users: [], currentUserRole: userTipoAcesso, isAdmin: isAdmin || canManage, isGerente }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Try listUsers, but handle failure gracefully
          const emailsByUserId = new Map<string, string>();
          try {
            const authUsersResult = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
            if (!authUsersResult.error) {
              (authUsersResult.data?.users || []).forEach((u: any) => {
                emailsByUserId.set(u.id, u.email || 'Email não disponível');
              });
            }
          } catch (e) {
            console.error('listUsers fallback also failed:', e);
          }

          profilesWithDetails = profiles.map((profile: any) => ({
            ...profile,
            email: emailsByUserId.get(profile.id) || 'Email não disponível',
            empresas: [],
          }));
        }

        if (profilesWithDetails.length === 0) {
          return new Response(
            JSON.stringify({ users: [], currentUserRole: userTipoAcesso, isAdmin: isAdmin || canManage, isGerente }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch user_empresas separately
        const profileIds = profilesWithDetails.map((p: any) => p.id);
        const companiesByUser = new Map<string, any[]>();
        try {
          const { data: userEmpresasData } = await supabaseAdmin
            .from('user_empresas')
            .select('user_id, empresa_id, is_ativa, empresas(id, nome_empresa)')
            .in('user_id', profileIds.slice(0, 100));

          (userEmpresasData || []).forEach((ue: any) => {
            if (!companiesByUser.has(ue.user_id)) {
              companiesByUser.set(ue.user_id, []);
            }
            if (ue.empresas) {
              companiesByUser.get(ue.user_id)!.push(ue.empresas);
            }
          });
        } catch (e) {
          console.error('Error fetching user companies (continuing without):', e);
        }

        // Attach companies to profiles
        profilesWithDetails = profilesWithDetails.map((profile: any) => ({
          ...profile,
          empresas: companiesByUser.get(profile.id) || [],
        }));

        // For Gerentes, apply additional filtering by shared companies
        if (isGerente && !canManage && gerenteCompanies.length > 0) {
          profilesWithDetails = profilesWithDetails.filter((profile: any) => {
            if (profile.empresas.length === 0) return true;
            const userCompanyIds = profile.empresas.map((e: any) => e.id);
            return userCompanyIds.some((companyId: string) => gerenteCompanies.includes(companyId));
          });
        }

        console.log('Profiles with details after filtering:', profilesWithDetails.length);

        return new Response(
          JSON.stringify({
            users: profilesWithDetails,
            currentUserRole: userTipoAcesso,
            isAdmin: isAdmin || canManage,
            isGerente: isGerente
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_user': {
        const { email, password, nome_completo, tipo_acesso, departamento, celular, cpf, status, empresas } = payload;

        // Gerentes can create SDR, Vendedor, CRM, Recepcionista, or other Gerentes in their companies
        if (isGerente && !canManage) {
          // Gerentes can create these roles
          if (!['SDR', 'Vendedor', 'Recepcionista', 'CRM', 'Gerente de Leads', 'Gerente de Loja'].includes(tipo_acesso)) {
            throw new Error('Gerentes só podem criar usuários SDR, Vendedor, CRM, Recepcionista ou outros Gerentes');
          }
          
          // Validate companies - must be in gerente's companies
          const invalidCompanies = empresas.filter((empresaId: string) => !gerenteCompanies.includes(empresaId));
          if (invalidCompanies.length > 0) {
            throw new Error('Você só pode criar usuários nas suas lojas');
          }
        }
        // If user is not admin/TI, validate they can only create users in their owned companies
        else if (!canManage && ownedCompanies.length > 0) {
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
        
        // Gerentes cannot delete users
        if (isGerente && !canManage) {
          throw new Error('Gerentes não podem excluir usuários');
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
        
        // Get the target user's current profile to check their tipo_acesso
        const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
          .from('profiles')
          .select('tipo_acesso')
          .eq('id', user_id)
          .single();
        
        if (targetProfileError) {
          throw new Error('Error fetching target user profile');
        }
        
        const targetTipoAcesso = targetProfile?.tipo_acesso || '';
        
        // Gerentes can update SDR, Vendedor, CRM, Recepcionista, or other Gerentes in their companies
        if (isGerente && !canManage) {
          // Check if target user is one of the allowed roles
          if (!['SDR', 'Vendedor', 'Recepcionista', 'CRM', 'Gerente de Leads', 'Gerente de Loja'].includes(targetTipoAcesso)) {
            throw new Error('Gerentes só podem editar usuários SDR, Vendedor, CRM, Recepcionista ou outros Gerentes');
          }
          
          // Check if the user being updated belongs to gerente's companies OR has no companies
          const { data: userCompanies, error: userCompaniesError } = await supabaseAdmin
            .from('user_empresas')
            .select('empresa_id')
            .eq('user_id', user_id);

          if (userCompaniesError) {
            throw new Error('Error checking user companies');
          }

          const userCompanyIds = userCompanies?.map(uc => uc.empresa_id) || [];
          
          // Allow if user has no companies (unassigned) or has at least one common company
          if (userCompanyIds.length > 0) {
            const hasPermission = userCompanyIds.some(companyId => gerenteCompanies.includes(companyId));
            if (!hasPermission) {
              throw new Error('Você só pode editar usuários das suas lojas');
            }
          }
          
          // Gerentes can set tipo_acesso to SDR, Vendedor, CRM, Recepcionista, or Gerentes
          if (!['SDR', 'Vendedor', 'Recepcionista', 'CRM', 'Gerente de Leads', 'Gerente de Loja'].includes(tipo_acesso)) {
            throw new Error('Gerentes só podem definir tipo de acesso SDR, Vendedor, CRM, Recepcionista ou Gerente');
          }
          
          // Validate new companies - must be in gerente's companies
          if (empresas) {
            const invalidCompanies = empresas.filter((empresaId: string) => !gerenteCompanies.includes(empresaId));
            if (invalidCompanies.length > 0) {
              throw new Error('Você só pode atribuir usuários às suas lojas');
            }
          }
        }
        // If user is not admin/TI, validate they can only update users in their owned companies
        else if (!canManage && ownedCompanies.length > 0) {
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
          // First, get existing relationships to preserve is_ativa status
          const { data: existingRelations } = await supabaseAdmin
            .from('user_empresas')
            .select('empresa_id, is_ativa')
            .eq('user_id', user_id);
          
          // Build a map of existing is_ativa status
          const existingActiveMap = new Map<string, boolean>();
          (existingRelations || []).forEach(rel => {
            existingActiveMap.set(rel.empresa_id, rel.is_ativa || false);
          });

          // Delete existing relationships
          const { error: deleteError } = await supabaseAdmin
            .from('user_empresas')
            .delete()
            .eq('user_id', user_id);

          if (deleteError) {
            console.error('Error deleting user company relationships:', deleteError);
            throw deleteError;
          }

          // Check if any previously active empresa is still in the new list
          const hasActiveInNewList = empresas.some((empresaId: string) => existingActiveMap.get(empresaId) === true);

          // Create new relationships preserving is_ativa status
          const userEmpresasData = empresas.map((empresaId: string, index: number) => ({
            user_id: user_id,
            empresa_id: empresaId,
            // Preserve existing is_ativa, or set first as active if no previous active found
            is_ativa: existingActiveMap.has(empresaId) 
              ? existingActiveMap.get(empresaId)! 
              : (!hasActiveInNewList && index === 0)
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

      case 'toggle_empresa_ativa': {
        const { user_id, empresa_id, is_ativa } = payload;

        if (!user_id || !empresa_id) {
          throw new Error('User ID and Empresa ID are required');
        }

        // Update the is_ativa status
        const { error: updateError } = await supabaseAdmin
          .from('user_empresas')
          .update({ is_ativa, updated_at: new Date().toISOString() })
          .eq('user_id', user_id)
          .eq('empresa_id', empresa_id);

        if (updateError) throw updateError;

        console.log('User empresa toggled:', user_id, empresa_id, is_ativa);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: is_ativa ? 'Empresa ativada' : 'Empresa desativada'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set_active_empresa': {
        const { user_id, empresa_id } = payload;

        if (!user_id || !empresa_id) {
          throw new Error('User ID and Empresa ID are required');
        }

        // First, deactivate all empresas for this user
        const { error: deactivateError } = await supabaseAdmin
          .from('user_empresas')
          .update({ is_ativa: false, updated_at: new Date().toISOString() })
          .eq('user_id', user_id);

        if (deactivateError) throw deactivateError;

        // Then activate the selected one
        const { error: activateError } = await supabaseAdmin
          .from('user_empresas')
          .update({ is_ativa: true, updated_at: new Date().toISOString() })
          .eq('user_id', user_id)
          .eq('empresa_id', empresa_id);

        if (activateError) throw activateError;

        console.log('Active empresa set:', user_id, empresa_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Empresa ativa definida com sucesso'
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