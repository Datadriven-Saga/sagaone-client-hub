import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useAdminCheck() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        console.log('useAdminCheck: No user found');
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      console.log('useAdminCheck: Checking admin status for user:', user.id, user.email);

      try {
        // Use the new security definer function
        const { data: adminData, error: adminError } = await supabase
          .rpc('check_user_is_admin');

        console.log('useAdminCheck: check_user_is_admin() result:', { data: adminData, error: adminError });

        if (!adminError && adminData !== null) {
          console.log('useAdminCheck: Final admin status from RPC:', adminData);
          setIsAdmin(adminData);
        } else {
          // Fallback: Direct query to profiles table
          console.log('useAdminCheck: Fallback to direct query');
          const { data, error } = await supabase
            .from('profiles')
            .select('tipo_acesso')
            .eq('id', user.id)
            .single();

          console.log('useAdminCheck: Direct query result:', { data, error });

          if (error) {
            console.error('Error checking admin status:', error);
            setIsAdmin(false);
          } else {
            const isAdminUser = data?.tipo_acesso === 'Administrador';
            console.log('useAdminCheck: Final admin status from direct query:', isAdminUser);
            setIsAdmin(isAdminUser);
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkAdminStatus();
  }, [user]);

  return { isAdmin, loading };
}