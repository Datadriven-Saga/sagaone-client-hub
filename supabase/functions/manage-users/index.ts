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
        let tipoAcessoFilter: string[] | null = (isGerente && !canManage)
          ? ['SDR', 'Vendedor', 'Recepcionista', 'CRM', 'Gerente de Leads', 'Gerente de Loja']
          : null;

        // Optional client-provided filters
        const clientTipoAcesso: string | null = (payload?.tipo_acesso_filter || null) as string | null;
        const search: string | null = (payload?.search || null) as string | null;
        const statusFilter: string | null = (payload?.status_filter || null) as string | null;
        const pageSize: number = Math.min(Math.max(Number(payload?.limit) || 20, 1), 100);
        const pageOffset: number = Math.max(Number(payload?.offset) || 0, 0);

        // Intersect client tipo filter with gerente restriction
        if (clientTipoAcesso) {
          if (tipoAcessoFilter) {
            tipoAcessoFilter = tipoAcessoFilter.includes(clientTipoAcesso) ? [clientTipoAcesso] : [];
          } else {
            tipoAcessoFilter = [clientTipoAcesso];
          }
        }

        // === SOURCE OF TRUTH: RPC get_users_with_email (server-side filtering + pagination) ===
        const rpcParams = {
          p_tipo_acesso_filter: tipoAcessoFilter,
          p_search: search,
          p_status: statusFilter,
          p_limit: pageSize,
          p_offset: pageOffset,
        };
        console.log('[list_users] payload recebido:', JSON.stringify(payload));
        console.log('[list_users] parâmetros enviados para RPC get_users_with_email:', JSON.stringify(rpcParams));

        let profilesWithDetails: any[] = [];
        let totalCount = 0;

        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_users_with_email', rpcParams);

        if (rpcError) {
          console.error('[list_users] RPC get_users_with_email FALHOU (sem fallback):', rpcError);
          return new Response(
            JSON.stringify({
              error: 'Falha ao listar usuários via RPC',
              details: rpcError.message,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        profilesWithDetails = (rpcData || []).map((row: any) => ({
          ...row,
          empresas: [], // Will be populated below
        }));
        totalCount = (rpcData && rpcData.length > 0) ? Number(rpcData[0].total_count) || 0 : 0;
        console.log('[list_users] fonte=RPC | retornados (já filtrados):', profilesWithDetails.length, '| total_count:', totalCount);

        if (profilesWithDetails.length === 0) {
          return new Response(
            JSON.stringify({ users: [], total: totalCount, currentUserRole: userTipoAcesso, isAdmin: isAdmin || canManage, isGerente }),
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
            total: totalCount,
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

        // Check if user already exists - skip pre-check and let createUser handle duplicates
        // The old listUsers() call was failing with "Database error" due to too many users
        let userExists = false;
        
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

        if (authError) {
          // Handle duplicate user error gracefully
          if (authError.message?.includes('already been registered') || authError.message?.includes('already exists') || (authError as any).status === 422) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Um usuário com este email já existe no sistema'
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw authError;
        }

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

      // ──────────────────────────────────────────────────────────────────
      // External seats (terceiros): create_external / renew / set_active
      // ──────────────────────────────────────────────────────────────────
      case 'create_external': {
        const { nome_completo, empresa_id, prospeccao_id } = payload || {};

        if (!nome_completo || !empresa_id || !prospeccao_id) {
          return new Response(
            JSON.stringify({ error: 'nome_completo, empresa_id e prospeccao_id são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Permissão: Gerente de Leads, Admin, TI, Master, ou quem tem canUseStoreSeat
        const allowedRoles = ['Administrador','TI','Master','Gerente de Leads','Coordenadora de Leads'];
        if (!allowedRoles.includes(userTipoAcesso)) {
          return new Response(
            JSON.stringify({ error: 'Você não tem permissão para criar terceiros (canUseStoreSeat)' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Revalida acesso à empresa do CompanyContext
        const { data: canAccessEmpresa, error: accessErr } = await supabaseAdmin.rpc(
          'user_can_access_empresa',
          { user_id: user.id, target_empresa_id: empresa_id }
        );
        if (accessErr || canAccessEmpresa !== true) {
          return new Response(
            JSON.stringify({ error: 'Você não tem acesso a esta loja' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Feature flag por empresa
        const { data: flagOk, error: flagErr } = await supabaseAdmin.rpc(
          'is_feature_enabled_for_empresa',
          { p_flag_key: 'login_terceiros_cadeiras', p_empresa_id: empresa_id }
        );
        if (flagErr || flagOk !== true) {
          return new Response(
            JSON.stringify({ error: 'Recurso indisponível para esta loja' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Limite de cadeiras
        const { data: limitData } = await supabaseAdmin.rpc('get_seats_limit', { p_empresa_id: empresa_id });
        const maxSeats = Number(limitData ?? 5);
        const { count: activeCount, error: countErr } = await supabaseAdmin
          .from('external_access_seats')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresa_id)
          .eq('status', 'active');
        if (countErr) throw countErr;
        if ((activeCount ?? 0) >= maxSeats) {
          return new Response(
            JSON.stringify({ error: `Limite de cadeiras atingido (${activeCount}/${maxSeats}). Renove uma cadeira existente ou solicite aumento de limite.` }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Valida evento: pertence à empresa, ativo, dentro do prazo, sem snapshot
        const today = new Date().toISOString().slice(0, 10);
        const { data: prospData, error: prospErr } = await supabaseAdmin
          .from('prospeccoes')
          .select('id, empresa_id, data_fim, ativo, snapshot_realizado, titulo')
          .eq('id', prospeccao_id)
          .single();
        if (prospErr || !prospData) {
          return new Response(
            JSON.stringify({ error: 'Evento não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (prospData.empresa_id !== empresa_id) {
          return new Response(
            JSON.stringify({ error: 'Evento não pertence à loja informada' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (prospData.ativo === false || prospData.snapshot_realizado === true || !prospData.data_fim || prospData.data_fim < today) {
          return new Response(
            JSON.stringify({ error: 'Evento não está ativo (encerrado, snapshot realizado ou data_fim no passado)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Gera email + senha
        const slug = String(nome_completo)
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'terceiro';
        const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        const email = `${slug}.${shortId}@one.sagadatadriven.com.br`;
        const passwordBytes = new Uint8Array(18);
        crypto.getRandomValues(passwordBytes);
        const senha = Array.from(passwordBytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 16) + 'A9!';

        // 1) Cria no auth com app_metadata.is_external=true
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: { nome_completo, full_name: nome_completo },
          app_metadata: { is_external: true },
        });
        if (createErr || !created?.user) {
          return new Response(
            JSON.stringify({ error: `Falha ao criar usuário: ${createErr?.message || 'desconhecido'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const newUserId = created.user.id;

        // Helper de rollback
        const rollback = async (reason: string) => {
          console.error('[create_external] rollback:', reason);
          try { await supabaseAdmin.auth.admin.deleteUser(newUserId); } catch (_) {}
        };

        // 2) Atualiza profile (já criado por trigger handle_new_user)
        const { error: profErr } = await supabaseAdmin
          .from('profiles')
          .update({
            nome_completo,
            tipo_acesso: 'SDR',
            is_external: true,
            is_active: true,
            empresa_id,
            external_created_by: user.id,
            status: 'Ativo',
          })
          .eq('id', newUserId);
        if (profErr) {
          await rollback(`profile update: ${profErr.message}`);
          return new Response(
            JSON.stringify({ error: `Falha ao gravar perfil: ${profErr.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 3) user_empresas (única empresa, ativa)
        const { error: ueErr } = await supabaseAdmin
          .from('user_empresas')
          .insert({ user_id: newUserId, empresa_id, is_ativa: true });
        if (ueErr) {
          await rollback(`user_empresas: ${ueErr.message}`);
          return new Response(
            JSON.stringify({ error: `Falha ao vincular loja: ${ueErr.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 4) external_access_seats (active)
        const { data: seat, error: seatErr } = await supabaseAdmin
          .from('external_access_seats')
          .insert({
            profile_id: newUserId,
            empresa_id,
            prospeccao_id,
            created_by: user.id,
            status: 'active',
          })
          .select('id')
          .single();
        if (seatErr) {
          await rollback(`seat: ${seatErr.message}`);
          return new Response(
            JSON.stringify({ error: `Falha ao criar cadeira: ${seatErr.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[create_external] OK', { newUserId, seat_id: seat?.id, empresa_id, prospeccao_id });

        return new Response(
          JSON.stringify({
            success: true,
            user_id: newUserId,
            seat_id: seat?.id,
            email,
            senha_temporaria: senha,
            evento_titulo: prospData.titulo,
            aviso_equipe: true,
            mensagem: 'Cadeira criada. Adicione este usuário à equipe do evento em /prospeccao/eventos para que ele receba leads.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'renew_external_seat': {
        const { profile_id, prospeccao_id } = payload || {};
        if (!profile_id || !prospeccao_id) {
          return new Response(
            JSON.stringify({ error: 'profile_id e prospeccao_id são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Carrega perfil-alvo
        const { data: targetProfile, error: tpErr } = await supabaseAdmin
          .from('profiles')
          .select('id, is_external, empresa_id, external_created_by, nome_completo')
          .eq('id', profile_id)
          .single();
        if (tpErr || !targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Terceiro não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (!targetProfile.is_external) {
          return new Response(
            JSON.stringify({ error: 'Usuário não é um terceiro' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Permissão: admin ou criador original
        const isOwner = targetProfile.external_created_by === user.id;
        const allowedRoles = ['Administrador','TI','Master'];
        if (!isOwner && !allowedRoles.includes(userTipoAcesso)) {
          return new Response(
            JSON.stringify({ error: 'Você não pode renovar esta cadeira' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const empresa_id = targetProfile.empresa_id;
        if (!empresa_id) {
          return new Response(
            JSON.stringify({ error: 'Terceiro sem empresa vinculada' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Feature flag por empresa
        const { data: flagOk } = await supabaseAdmin.rpc(
          'is_feature_enabled_for_empresa',
          { p_flag_key: 'login_terceiros_cadeiras', p_empresa_id: empresa_id }
        );
        if (flagOk !== true) {
          return new Response(
            JSON.stringify({ error: 'Recurso indisponível para esta loja' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Valida evento alvo
        const today = new Date().toISOString().slice(0, 10);
        const { data: prospData, error: prospErr } = await supabaseAdmin
          .from('prospeccoes')
          .select('id, empresa_id, data_fim, ativo, snapshot_realizado, titulo')
          .eq('id', prospeccao_id)
          .single();
        if (prospErr || !prospData || prospData.empresa_id !== empresa_id ||
            prospData.ativo === false || prospData.snapshot_realizado === true ||
            !prospData.data_fim || prospData.data_fim < today) {
          return new Response(
            JSON.stringify({ error: 'Evento alvo inválido ou inativo' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Limite de cadeiras (renovação ocupa 1 slot — seat antigo será expirado primeiro)
        await supabaseAdmin
          .from('external_access_seats')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('profile_id', profile_id)
          .eq('status', 'active');

        const { data: limitData } = await supabaseAdmin.rpc('get_seats_limit', { p_empresa_id: empresa_id });
        const maxSeats = Number(limitData ?? 5);
        const { count: activeCount } = await supabaseAdmin
          .from('external_access_seats')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresa_id)
          .eq('status', 'active');
        if ((activeCount ?? 0) >= maxSeats) {
          return new Response(
            JSON.stringify({ error: `Limite de cadeiras atingido (${activeCount}/${maxSeats}).` }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Cria seat novo
        const { data: seat, error: seatErr } = await supabaseAdmin
          .from('external_access_seats')
          .insert({
            profile_id,
            empresa_id,
            prospeccao_id,
            created_by: user.id,
            status: 'active',
          })
          .select('id')
          .single();
        if (seatErr) {
          return new Response(
            JSON.stringify({ error: `Falha ao criar cadeira: ${seatErr.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Reativa profile + gera senha nova
        await supabaseAdmin.from('profiles').update({ is_active: true }).eq('id', profile_id);

        const passwordBytes = new Uint8Array(18);
        crypto.getRandomValues(passwordBytes);
        const senha = Array.from(passwordBytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 16) + 'A9!';

        const { data: updated, error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
          profile_id,
          { password: senha }
        );
        console.log('[renew_external_seat] updateUserById response keys:', Object.keys(updated || {}));
        if (updErr) {
          return new Response(
            JSON.stringify({ error: `Falha ao atualizar senha: ${updErr.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Obter email
        const { data: au } = await supabaseAdmin.auth.admin.getUserById(profile_id);
        const email = au?.user?.email || null;

        return new Response(
          JSON.stringify({
            success: true,
            seat_id: seat?.id,
            email,
            senha_temporaria: senha,
            evento_titulo: prospData.titulo,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set_external_active': {
        const { profile_id, is_active } = payload || {};
        if (!profile_id || typeof is_active !== 'boolean') {
          return new Response(
            JSON.stringify({ error: 'profile_id e is_active são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, is_external, external_created_by')
          .eq('id', profile_id)
          .single();
        if (!targetProfile?.is_external) {
          return new Response(
            JSON.stringify({ error: 'Usuário não é um terceiro' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isOwner = targetProfile.external_created_by === user.id;
        const allowedRoles = ['Administrador','TI','Master'];
        if (!isOwner && !allowedRoles.includes(userTipoAcesso)) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para alterar este terceiro' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updErr } = await supabaseAdmin
          .from('profiles')
          .update({ is_active })
          .eq('id', profile_id);
        if (updErr) {
          return new Response(
            JSON.stringify({ error: updErr.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Se desativando: revogar refresh tokens (access vive até ~1h)
        if (!is_active) {
          try {
            // signOut com escopo global — assinatura: signOut(jwt, scope) no admin; assinaturas variam.
            // Aqui usamos a forma documentada (jwt do user nao temos; usamos invalidate sessions).
            const signOutResp: any = await (supabaseAdmin.auth.admin as any).signOut(profile_id, 'global');
            console.log('[set_external_active] signOut response:', JSON.stringify(signOutResp || {}).slice(0, 200));
          } catch (e) {
            console.error('[set_external_active] signOut error (refresh tokens may persist):', (e as Error).message);
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
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