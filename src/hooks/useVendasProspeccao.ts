import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

export interface VendaProspeccao {
  id: string;
  prospeccao_id: string;
  numero_venda: number;
  contato_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  responsavel_id: string | null;
  produto_id: string | null;
  departamento_id: string | null;
  data_venda: string;
  valor_venda: number | null;
  comprovante_url: string | null;
  empresa_id: string;
  created_at: string;
  updated_at: string;
  // Joins
  responsavel?: {
    id: string;
    nome_completo: string;
    tipo_acesso: string | null;
  };
  produto?: {
    id: string;
    nome: string;
  };
  departamento?: {
    id: string;
    nome: string;
  };
  prospeccao?: {
    id: string;
    titulo: string;
  };
}

export function useVendasProspeccao() {
  const [vendas, setVendas] = useState<VendaProspeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeCompany } = useCompany();
  const { user } = useAuth();

  const fetchVendas = useCallback(async () => {
    if (!activeCompany?.id) {
      setVendas([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendas_prospeccao')
        .select(`
          *,
          responsavel:profiles!vendas_prospeccao_responsavel_id_fkey(id, nome_completo, tipo_acesso),
          produto:produtos!vendas_prospeccao_produto_id_fkey(id, nome),
          departamento:departamentos!vendas_prospeccao_departamento_id_fkey(id, nome),
          prospeccao:prospeccoes!vendas_prospeccao_prospeccao_id_fkey(id, titulo)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendas(data || []);
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchVendas();
  }, [fetchVendas]);

  const criarVenda = async (params: {
    prospeccaoId: string;
    contatoId: string;
    clienteNome: string;
    clienteTelefone: string | null;
    responsavelId: string | null;
    produtoId: string;
    departamentoId: string | null;
    dataVenda?: string;
    valorVenda?: number | null;
  }) => {
    if (!activeCompany?.id) throw new Error('Empresa não selecionada');

    // Get next sale number for this prospeccao
    const { data: nextNumData, error: nextNumError } = await supabase
      .rpc('get_next_venda_numero', { p_prospeccao_id: params.prospeccaoId });

    if (nextNumError) throw nextNumError;

    const numeroVenda = nextNumData || 1;

    const { data, error } = await supabase
      .from('vendas_prospeccao')
      .insert({
        prospeccao_id: params.prospeccaoId,
        numero_venda: numeroVenda,
        contato_id: params.contatoId,
        cliente_nome: params.clienteNome,
        cliente_telefone: params.clienteTelefone,
        responsavel_id: params.responsavelId,
        produto_id: params.produtoId,
        departamento_id: params.departamentoId,
        data_venda: params.dataVenda || new Date().toISOString().split('T')[0],
        valor_venda: params.valorVenda,
        empresa_id: activeCompany.id,
      })
      .select()
      .single();

    if (error) throw error;
    
    await fetchVendas();
    return data;
  };

  const atualizarVenda = async (vendaId: string, updates: {
    data_venda?: string;
    valor_venda?: number | null;
    comprovante_url?: string | null;
  }) => {
    const { error } = await supabase
      .from('vendas_prospeccao')
      .update(updates)
      .eq('id', vendaId);

    if (error) throw error;
    await fetchVendas();
  };

  const excluirVenda = async (vendaId: string) => {
    const { error } = await supabase
      .from('vendas_prospeccao')
      .delete()
      .eq('id', vendaId);

    if (error) throw error;
    await fetchVendas();
  };

  return {
    vendas,
    loading,
    criarVenda,
    atualizarVenda,
    excluirVenda,
    refetch: fetchVendas,
  };
}
