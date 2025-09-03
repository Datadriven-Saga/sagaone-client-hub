import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export function useClientesData() {
  const { activeCompany } = useCompany();
  const [clientes, setClientes] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    total: 0,
    comTelefone: 0,
    comEmail: 0,
    realizaramCompra: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany?.id) {
      setLoading(false);
      return;
    }

    async function fetchClientes() {
      try {
        const { data: clientesData, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('empresa_id', activeCompany.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const clientesList = clientesData || [];
        
        // Buscar vendas para cada cliente para verificar se realizaram compra
        const { data: vendasData } = await supabase
          .from('vendas')
          .select('cliente_id')
          .eq('empresa_id', activeCompany.id);

        const clientesComCompra = new Set(vendasData?.map(v => v.cliente_id) || []);

        const clientesFormatted = clientesList.map(cliente => ({
          id: cliente.id,
          name: cliente.nome,
          phone: cliente.telefone || '',
          email: cliente.email || '',
          gender: cliente.data_nascimento ? 'Informado' : 'Não informado',
          birthDate: cliente.data_nascimento || '-',
          document: cliente.cpf_cnpj || '-',
          hasPurchased: clientesComCompra.has(cliente.id) ? "Sim" : "Não",
          responsible: "Sistema", // Pode ser melhorado com dados de responsável
          products: "-", // Pode ser melhorado com dados de produtos
          lastPurchase: "-" // Pode ser melhorado com última compra
        }));

        setClientes(clientesFormatted);
        
        setKpis({
          total: clientesList.length,
          comTelefone: clientesList.filter(c => c.telefone).length,
          comEmail: clientesList.filter(c => c.email).length,
          realizaramCompra: clientesComCompra.size
        });

      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchClientes();
  }, [activeCompany?.id]);

  return { clientes, kpis, loading };
}