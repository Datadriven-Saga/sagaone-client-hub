import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface UseClientesDataProps {
  prospeccaoId?: string; // "todos" ou ID específico
}

// Normaliza telefone para deduplicação
const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.substring(2);
  }
  return digits;
};

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

      // ESTRATÉGIA OTIMIZADA:
      // 1. Buscar contagem e KPIs via count() - super rápido
      // 2. Buscar apenas os primeiros 500 registros para exibição (paginação no frontend)
      // 3. Executar queries em paralelo

      if (prospeccaoId === "todos") {
        // Executar queries em PARALELO para máxima velocidade
        const [
          countResult,
          countTelefoneResult,
          countEmailResult,
          contatosResult,
          vendasResult
        ] = await Promise.all([
          // Count total
          supabase
            .from('contatos')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', activeCompany.id),
          // Count com telefone
          supabase
            .from('contatos')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', activeCompany.id)
            .not('telefone', 'is', null)
            .neq('telefone', ''),
          // Count com email
          supabase
            .from('contatos')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', activeCompany.id)
            .not('email', 'is', null)
            .neq('email', ''),
          // Buscar registros para lista (limite de 2000 para deduplicação eficiente)
          supabase
            .from('contatos')
            .select('id, nome, telefone, email, responsavel_email, vendedor_nome, created_at')
            .eq('empresa_id', activeCompany.id)
            .order('created_at', { ascending: false })
            .limit(2000),
          // Vendas
          supabase
            .from('vendas_prospeccao')
            .select('contato_id')
            .eq('empresa_id', activeCompany.id)
        ]);

        const contatosList = contatosResult.data || [];
        const contatosComCompra = new Set((vendasResult.data || []).map(v => v.contato_id));

        // Deduplicar por telefone
        const seenPhones = new Set<string>();
        const uniqueContatos = contatosList.filter(contato => {
          const normalizedPhone = normalizePhone(contato.telefone);
          if (!normalizedPhone) return true;
          if (seenPhones.has(normalizedPhone)) return false;
          seenPhones.add(normalizedPhone);
          return true;
        });

        // Formatar para exibição
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

        // KPIs usando counts do servidor (mais precisos para grandes volumes)
        const totalFromServer = countResult.count || 0;
        const comTelefoneFromServer = countTelefoneResult.count || 0;
        const comEmailFromServer = countEmailResult.count || 0;
        const realizaramCompra = uniqueContatos.filter(c => contatosComCompra.has(c.id)).length;

        setKpis({
          total: uniqueContatos.length, // Usar deduplicado para consistência com lista
          comTelefone: comTelefoneFromServer > uniqueContatos.length 
            ? uniqueContatos.filter(c => c.telefone).length 
            : comTelefoneFromServer,
          comEmail: comEmailFromServer,
          realizaramCompra
        });

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

      } else {
        // Filtro por evento específico - otimizado
        const [eventosResult, vendasResult] = await Promise.all([
          supabase
            .from('eventos_prospeccao')
            .select('contato_id')
            .eq('prospeccao_id', prospeccaoId),
          supabase
            .from('vendas_prospeccao')
            .select('contato_id')
            .eq('empresa_id', activeCompany.id)
        ]);

        const contatoIds = [...new Set((eventosResult.data || []).map(ep => ep.contato_id).filter(Boolean))] as string[];
        const contatosComCompra = new Set((vendasResult.data || []).map(v => v.contato_id));

        if (contatoIds.length === 0) {
          setClientes([]);
          setKpis({ total: 0, comTelefone: 0, comEmail: 0, realizaramCompra: 0 });
          setDistribuicaoGenero({ masculino: 0, feminino: 0, naoInformado: 0 });
          setDistribuicaoDocumento({ cpf: 0, cnpj: 0, naoInformado: 0 });
          setLoading(false);
          return;
        }

        // Buscar contatos em lotes paralelos (máximo 200 por lote)
        const IN_BATCH_SIZE = 200;
        const batches = [];
        for (let i = 0; i < Math.min(contatoIds.length, 1000); i += IN_BATCH_SIZE) {
          const batchIds = contatoIds.slice(i, i + IN_BATCH_SIZE);
          batches.push(
            supabase
              .from('contatos')
              .select('id, nome, telefone, email, responsavel_email, vendedor_nome, created_at')
              .in('id', batchIds)
              .eq('empresa_id', activeCompany.id)
          );
        }

        const batchResults = await Promise.all(batches);
        let contatosList: any[] = [];
        batchResults.forEach(result => {
          if (result.data) {
            contatosList = [...contatosList, ...result.data];
          }
        });

        // Ordenar por data
        contatosList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Deduplicar por telefone
        const seenPhones = new Set<string>();
        const uniqueContatos = contatosList.filter(contato => {
          const normalizedPhone = normalizePhone(contato.telefone);
          if (!normalizedPhone) return true;
          if (seenPhones.has(normalizedPhone)) return false;
          seenPhones.add(normalizedPhone);
          return true;
        });

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

        setKpis({
          total: uniqueContatos.length,
          comTelefone: uniqueContatos.filter(c => c.telefone).length,
          comEmail: uniqueContatos.filter(c => c.email).length,
          realizaramCompra: uniqueContatos.filter(c => contatosComCompra.has(c.id)).length
        });

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
      }

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
