import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

export interface Prospect {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  status: string;
  origem?: string;
  valor_potencial?: number;
  observacoes?: string;
  responsavel_id?: string;
  responsavel_email?: string;
  cliente_id?: string;
  empresa_id: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export function useProspectData() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeCompany } = useCompany();

  const fetchProspects = async () => {
    if (!activeCompany?.id) {
      console.warn('useProspectData: No active company found');
      setLoading(false);
      return;
    }

    try {
      console.log('useProspectData: Fetching prospects for company:', activeCompany.id);
      
      const { data, error } = await supabase
        .from('prospect')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('useProspectData: Error fetching prospects:', error);
        throw error;
      }

      console.log('useProspectData: Prospects fetched:', data?.length || 0);
      setProspects(data || []);
    } catch (error) {
      console.error('useProspectData: Error in fetchProspects:', error);
      toast.error('Erro ao carregar prospects: ' + (error as Error).message);
      setProspects([]);
    } finally {
      setLoading(false);
    }
  };

  const createProspect = async (prospectData: Omit<Prospect, 'id' | 'created_at' | 'updated_at' | 'empresa_id' | 'user_id'>) => {
    if (!activeCompany?.id) {
      toast.error('Empresa não selecionada');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('prospect')
        .insert([{
          ...prospectData,
          empresa_id: activeCompany.id
        }])
        .select()
        .single();

      if (error) {
        console.error('useProspectData: Error creating prospect:', error);
        throw error;
      }

      toast.success('Prospect criado com sucesso');
      await fetchProspects(); // Refresh data
      return data;
    } catch (error) {
      console.error('useProspectData: Error in createProspect:', error);
      toast.error('Erro ao criar prospect: ' + (error as Error).message);
      return null;
    }
  };

  const updateProspectStatus = async (prospectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('prospect')
        .update({ status: newStatus })
        .eq('id', prospectId);

      if (error) {
        console.error('useProspectData: Error updating prospect status:', error);
        throw error;
      }

      await fetchProspects(); // Refresh data
      return true;
    } catch (error) {
      console.error('useProspectData: Error in updateProspectStatus:', error);
      toast.error('Erro ao atualizar status: ' + (error as Error).message);
      return false;
    }
  };

  const syncProspectToCliente = async (prospect: Prospect) => {
    if (!activeCompany?.id) {
      toast.error('Empresa não selecionada');
      return null;
    }

    try {
      // Verificar se já existe cliente com mesmo nome e telefone
      const { data: existingCliente, error: searchError } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', prospect.nome)
        .eq('telefone', prospect.telefone || '')
        .eq('empresa_id', activeCompany.id)
        .maybeSingle();

      if (searchError) {
        console.error('useProspectData: Error searching existing cliente:', searchError);
        throw searchError;
      }

      let clienteId = existingCliente?.id;

      // Se não existe, criar novo cliente
      if (!clienteId) {
        const { data: newCliente, error: createError } = await supabase
          .from('clientes')
          .insert([{
            nome: prospect.nome,
            telefone: prospect.telefone,
            email: prospect.email,
            empresa_id: activeCompany.id,
            observacoes: `Cliente criado via prospecção - ${prospect.observacoes || ''}`
          }])
          .select()
          .single();

        if (createError) {
          console.error('useProspectData: Error creating cliente:', createError);
          throw createError;
        }

        clienteId = newCliente.id;
        toast.success('Cliente criado na carteira');
      }

      // Atualizar prospect com cliente_id
      const { error: updateError } = await supabase
        .from('prospect')
        .update({ cliente_id: clienteId })
        .eq('id', prospect.id);

      if (updateError) {
        console.error('useProspectData: Error updating prospect with cliente_id:', updateError);
        throw updateError;
      }

      await fetchProspects(); // Refresh data
      return clienteId;
    } catch (error) {
      console.error('useProspectData: Error in syncProspectToCliente:', error);
      toast.error('Erro ao sincronizar com carteira: ' + (error as Error).message);
      return null;
    }
  };

  useEffect(() => {
    if (activeCompany?.id) {
      fetchProspects();
    } else {
      setProspects([]);
      setLoading(false);
    }
  }, [activeCompany?.id]);

  return {
    prospects,
    loading,
    fetchProspects,
    createProspect,
    updateProspectStatus,
    syncProspectToCliente
  };
}