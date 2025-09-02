import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Check if user can manage users
    const { data: canManage, error: permError } = await supabase
      .rpc('can_manage_users', { user_id: user.id });

    if (permError || !canManage) {
      throw new Error('Insufficient permissions to manage users');
    }

    const { action, ...payload } = await req.json();

    console.log('User management action:', action, 'by user:', user.id);

    switch (action) {
      case 'list_users': {
        // Get all profiles with user emails
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          throw profilesError;
        }

        console.log('Found profiles:', profiles?.length || 0);

        // Get user emails from auth using admin client
        const profilesWithEmails = await Promise.all(
          (profiles || []).map(async (profile) => {
            try {
              const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
              if (userError) {
                console.error('Error fetching user data for:', profile.id, userError);
                return {
                  ...profile,
                  email: 'Email não disponível'
                };
              }
              return {
                ...profile,
                email: userData?.user?.email || 'Email não disponível'
              };
            } catch (error) {
              console.error('Error fetching user email for profile:', profile.id, error);
              return {
                ...profile,
                email: 'Email não disponível'
              };
            }
          })
        );

        console.log('Profiles with emails:', profilesWithEmails.length);

        return new Response(
          JSON.stringify({ users: profilesWithEmails }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_user': {
        const { email, password, nome_completo, tipo_acesso, departamento, celular, cpf, status } = payload;

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
          // Update the profile created by trigger
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              tipo_acesso,
              departamento,
              celular,
              cpf,
              status
            })
            .eq('id', authData.user.id);

          if (updateError) {
            console.error('Error updating profile:', updateError);
            // Try to clean up the created user
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw updateError;
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
        const { user_id, nome_completo, tipo_acesso, departamento, celular, cpf, status } = payload;

        if (!user_id) {
          throw new Error('User ID is required');
        }

        // Update profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            nome_completo,
            tipo_acesso,
            departamento,
            celular,
            cpf,
            status
          })
          .eq('id', user_id);

        if (updateError) throw updateError;

        // Also update the user metadata
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          {
            user_metadata: {
              nome_completo,
              full_name: nome_completo
            }
          }
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
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false
      }),
      {
        status: error.message.includes('Insufficient permissions') ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});