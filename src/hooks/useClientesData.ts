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

      let contatosList: any[] = [];

      // CARTEIRA DE CLIENTES: 
      // - Se prospeccaoId é "todos": mostrar TODOS os contatos da empresa (de todos os canais)
      // - Se prospeccaoId é específico: mostrar apenas contatos vinculados àquele evento

      if (prospeccaoId === "todos") {
        // Buscar TODOS os contatos da empresa diretamente (paginação server-side)
        const PAGE_SIZE = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('contatos')
            .select('id, nome, telefone, email, responsavel_email, vendedor_nome, created_at')
            .eq('empresa_id', activeCompany.id)
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) {
            console.error('Erro ao buscar contatos:', error);
            break;
          }

          if (data && data.length > 0) {
            contatosList = [...contatosList, ...data];
            hasMore = data.length === PAGE_SIZE;
            page++;
          } else {
            hasMore = false;
          }
        }
      } else {
        // Filtro por evento específico: buscar via eventos_prospeccao (sincroniza com Kanban)
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

        // Buscar contatos vinculados ao evento específico
        const { data: eventosData } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .eq('prospeccao_id', prospeccaoId);

        const contatoIds = [...new Set((eventosData || []).map(ep => ep.contato_id).filter(Boolean))] as string[];

        if (contatoIds.length === 0) {
          setClientes([]);
          setKpis({ total: 0, comTelefone: 0, comEmail: 0, realizaramCompra: 0 });
          setDistribuicaoGenero({ masculino: 0, feminino: 0, naoInformado: 0 });
          setDistribuicaoDocumento({ cpf: 0, cnpj: 0, naoInformado: 0 });
          setLoading(false);
          return;
        }

        // Buscar dados dos contatos em lotes
        const IN_BATCH_SIZE = 200;
        for (let i = 0; i < contatoIds.length; i += IN_BATCH_SIZE) {
          const batchIds = contatoIds.slice(i, i + IN_BATCH_SIZE);
          const { data: batchData, error } = await supabase
            .from('contatos')
            .select('id, nome, telefone, email, responsavel_email, vendedor_nome, created_at')
            .in('id', batchIds)
            .eq('empresa_id', activeCompany.id);

          if (!error && batchData) {
            contatosList = [...contatosList, ...batchData];
          }
        }
      }

      // Verificar vendas para saber quais contatos compraram
      const { data: vendasData } = await supabase
        .from('vendas_prospeccao')
        .select('contato_id')
        .eq('empresa_id', activeCompany.id);

      const contatosComCompra = new Set((vendasData || []).map(v => v.contato_id));

      // DEDUPLICAÇÃO: Normalizar telefone e remover duplicatas
      // Mantém o registro mais recente (primeiro na lista ordenada por created_at desc)
      const normalizePhone = (phone: string | null): string => {
        if (!phone) return '';
        // Remove todos os caracteres não numéricos
        let digits = phone.replace(/\D/g, '');
        // Remove DDI 55 se tiver mais de 11 dígitos
        if (digits.length > 11 && digits.startsWith('55')) {
          digits = digits.substring(2);
        }
        return digits;
      };

      const seenPhones = new Set<string>();
      const uniqueContatos = contatosList.filter(contato => {
        const normalizedPhone = normalizePhone(contato.telefone);
        
        // Se não tem telefone, incluir (não pode deduplicar sem telefone)
        if (!normalizedPhone) return true;
        
        // Se já vimos esse telefone, pular (duplicata)
        if (seenPhones.has(normalizedPhone)) {
          return false;
        }
        
        seenPhones.add(normalizedPhone);
        return true;
      });

      // Formatar para exibição (usando lista deduplicada)
      const clientesFormatted = uniqueContatos.map(contato => ({
        id: contato.id,
        name: contato.nome,
        phone: contato.telefone || '',
        email: contato.email || '',
        gender: 'Não informado',
        birthDate: '-',
        document: '-',
        hasPurchased: contatosComCompra.has(contato.id) ? "Sim" : "Não",
        responsible: contato.vendedor_nome || contato.responsavel_email || "Sistema",
        products: "-",
        lastPurchase: "-",
        createdAt: contato.created_at
      }));

      setClientes(clientesFormatted);

      // Calcular KPIs (usando lista deduplicada)
      setKpis({
        total: uniqueContatos.length,
        comTelefone: uniqueContatos.filter(c => c.telefone).length,
        comEmail: uniqueContatos.filter(c => c.email).length,
        realizaramCompra: uniqueContatos.filter(c => contatosComCompra.has(c.id)).length
      });

      // Distribuições (usando lista deduplicada - contatos não têm esses campos detalhados)
      setDistribuicaoGenero({
        masculino: 0,
        feminino: 0,
        naoInformado: uniqueContatos.length
      });

      setDistribuicaoDocumento({
        cpf: 0,
        cnpj: 0,
        naoInformado: uniqueContatos.length
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
