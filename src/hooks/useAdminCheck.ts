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
        // First, try using the is_admin() function
        const { data: adminData, error: adminError } = await supabase
          .rpc('is_admin');

        console.log('useAdminCheck: is_admin() result:', { data: adminData, error: adminError });

        if (!adminError && adminData !== null) {
          setIsAdmin(adminData);
          setLoading(false);
          return;
        }

        // Fallback: Direct query to profiles table
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
          console.log('useAdminCheck: Final admin status:', isAdminUser);
          setIsAdmin(isAdminUser);
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