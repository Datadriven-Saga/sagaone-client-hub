import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface UseClientesDataProps {
  prospeccaoId?: string; // "todos" ou ID específico
}

export function useClientesData({ prospeccaoId = "todos" }: UseClientesDataProps = {}) {
  const { activeCompany } = useCompany();
  const [clientes, setClientes] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    total: 0,
    comTelefone: 0,
    comEmail: 0,
    realizaramCompra: 0
  });
  const [distribuicaoGenero, setDistribuicaoGenero] = useState({
    masculino: 0,
    feminino: 0,
    naoInformado: 0
  });
  const [distribuicaoDocumento, setDistribuicaoDocumento] = useState({
    cpf: 0,
    cnpj: 0,
    naoInformado: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchClientes = useCallback(async () => {
    if (!activeCompany?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // SINCRONIZAÇÃO: Buscar clientes vinculados a contatos que estão em eventos_prospeccao
      // Isso garante que os números batam com Kanban, Funil e Relatórios

      // 1. Buscar todas as prospecções da empresa
      const { data: prospeccoes } = await supabase
        .from('prospeccoes')
        .select('id')
        .eq('empresa_id', activeCompany.id);

      const prospeccaoIds = (prospeccoes || []).map(p => p.id);

      if (prospeccaoIds.length === 0) {
        setClientes([]);
        setKpis({ total: 0, comTelefone: 0, comEmail: 0, realizaramCompra: 0 });
        setDistribuicaoGenero({ masculino: 0, feminino: 0, naoInformado: 0 });
        setDistribuicaoDocumento({ cpf: 0, cnpj: 0, naoInformado: 0 });
        setLoading(false);
        return;
      }

      // 2. Buscar contatos vinculados a eventos (mesma lógica do Kanban)
      let eventoQuery = supabase
        .from('eventos_prospeccao')
        .select('contato_id, prospeccao_id')
        .in('prospeccao_id', prospeccaoIds);

      if (prospeccaoId && prospeccaoId !== "todos") {
        eventoQuery = eventoQuery.eq('prospeccao_id', prospeccaoId);
      }

      const { data: eventosData } = await eventoQuery;

      // Extrair IDs de contatos únicos
      const contatoIdsSet = new Set<string>();
      (eventosData || []).forEach(ep => {
        if (ep.contato_id) contatoIdsSet.add(ep.contato_id);
      });

      const contatoIds = Array.from(contatoIdsSet);

      if (contatoIds.length === 0) {
        setClientes([]);
        setKpis({ total: 0, comTelefone: 0, comEmail: 0, realizaramCompra: 0 });
        setDistribuicaoGenero({ masculino: 0, feminino: 0, naoInformado: 0 });
        setDistribuicaoDocumento({ cpf: 0, cnpj: 0, naoInformado: 0 });
        setLoading(false);
        return;
      }

      // 3. Buscar contatos que estão vinculados a eventos (usar contatos como fonte, não clientes)
      // Isso sincroniza com o Kanban que usa contatos
      const { data: contatosData, error: contatosError } = await supabase
        .from('contatos')
        .select('*')
        .in('id', contatoIds)
        .eq('empresa_id', activeCompany.id);

      if (contatosError) throw contatosError;

      const contatosList = contatosData || [];

      // 4. Verificar vendas
      const { data: vendasData } = await supabase
        .from('vendas_prospeccao')
        .select('contato_id')
        .eq('empresa_id', activeCompany.id);

      const contatosComCompra = new Set((vendasData || []).map(v => v.contato_id));

      // 5. Formatar para exibição
      const clientesFormatted = contatosList.map(contato => ({
        id: contato.id,
        name: contato.nome,
        phone: contato.telefone || '',
        email: contato.email || '',
        gender: 'Não informado', // Contatos não têm campo gênero
        birthDate: '-',
        document: '-', // Contatos não têm CPF/CNPJ
        hasPurchased: contatosComCompra.has(contato.id) ? "Sim" : "Não",
        responsible: contato.vendedor_nome || contato.responsavel_email || "Sistema",
        products: "-",
        lastPurchase: "-",
        createdAt: contato.created_at
      }));

      setClientes(clientesFormatted);

      // Calcular KPIs baseados nos contatos (sincronizado com Kanban)
      setKpis({
        total: contatosList.length,
        comTelefone: contatosList.filter(c => c.telefone).length,
        comEmail: contatosList.filter(c => c.email).length,
        realizaramCompra: contatosList.filter(c => contatosComCompra.has(c.id)).length
      });

      // Distribuições (contatos não têm esses campos, então ficam como "não informado")
      setDistribuicaoGenero({
        masculino: 0,
        feminino: 0,
        naoInformado: contatosList.length
      });

      setDistribuicaoDocumento({
        cpf: 0,
        cnpj: 0,
        naoInformado: contatosList.length
      });

    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, prospeccaoId]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  return { clientes, kpis, distribuicaoGenero, distribuicaoDocumento, loading, refetch: fetchClientes };
}
