import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface UseClientesDataProps {
  prospeccaoId?: string;
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

// Deduplicar contatos por telefone (extraído para reutilização)
function deduplicateByPhone<T extends { telefone?: string | null }>(list: T[]): T[] {
  const seenPhones = new Set<string>();
  return list.filter(item => {
    const normalized = normalizePhone(item.telefone ?? null);
    if (!normalized) return true;
    if (seenPhones.has(normalized)) return false;
    seenPhones.add(normalized);
    return true;
  });
}

// Formatar contato para exibição
function formatContato(contato: any, contatosComCompra: Set<string>) {
  return {
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
  };
}

export function useClientesData({ prospeccaoId = "todos" }: UseClientesDataProps = {}) {
  const { activeCompany } = useCompany();
  const [clientes, setClientes] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ total: 0, comTelefone: 0, comEmail: 0, realizaramCompra: 0 });
  const [distribuicaoGenero, setDistribuicaoGenero] = useState({ masculino: 0, feminino: 0, naoInformado: 0 });
  const [distribuicaoDocumento, setDistribuicaoDocumento] = useState({ cpf: 0, cnpj: 0, naoInformado: 0 });
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_TTL = 60_000; // 1 min

  const fetchClientes = useCallback(async () => {
    if (!activeCompany?.id) {
      setLoading(false);
      return;
    }

    const cacheKey = `${activeCompany.id}-${prospeccaoId}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const { clientes, kpis, genero, documento } = cached.data;
      setClientes(clientes);
      setKpis(kpis);
      setDistribuicaoGenero(genero);
      setDistribuicaoDocumento(documento);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.time(`[Clientes] fetch-${cacheKey}`);

      if (prospeccaoId === "todos") {
        await fetchAll(activeCompany.id, cacheKey);
      } else {
        await fetchByEvento(activeCompany.id, prospeccaoId, cacheKey);
      }

      console.timeEnd(`[Clientes] fetch-${cacheKey}`);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, prospeccaoId]);

  const fetchAll = async (empresaId: string, cacheKey: string) => {
    console.time('[Clientes] parallel-queries');
    const [countResult, countTelResult, countEmailResult, contatosResult, vendasResult] = await Promise.all([
      supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
      supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).not('telefone', 'is', null).neq('telefone', ''),
      supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).not('email', 'is', null).neq('email', ''),
      supabase.from('contatos').select('id, nome, telefone, email, responsavel_email, vendedor_nome, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(2000),
      supabase.from('vendas_prospeccao').select('contato_id').eq('empresa_id', empresaId),
    ]);
    console.timeEnd('[Clientes] parallel-queries');

    console.time('[Clientes] process-data');
    const contatosList = contatosResult.data || [];
    const contatosComCompra = new Set((vendasResult.data || []).map(v => v.contato_id));
    const uniqueContatos = deduplicateByPhone(contatosList);
    const clientesFormatted = uniqueContatos.map(c => formatContato(c, contatosComCompra));

    const comTelefoneServer = countTelResult.count || 0;
    const newKpis = {
      total: uniqueContatos.length,
      comTelefone: comTelefoneServer > uniqueContatos.length ? uniqueContatos.filter(c => c.telefone).length : comTelefoneServer,
      comEmail: countEmailResult.count || 0,
      realizaramCompra: uniqueContatos.filter(c => contatosComCompra.has(c.id)).length,
    };
    const genero = { masculino: 0, feminino: 0, naoInformado: uniqueContatos.length };
    const documento = { cpf: 0, cnpj: 0, naoInformado: uniqueContatos.length };
    console.timeEnd('[Clientes] process-data');

    cacheRef.current.set(cacheKey, { data: { clientes: clientesFormatted, kpis: newKpis, genero, documento }, timestamp: Date.now() });
    setClientes(clientesFormatted);
    setKpis(newKpis);
    setDistribuicaoGenero(genero);
    setDistribuicaoDocumento(documento);
  };

  const fetchByEvento = async (empresaId: string, eventoId: string, cacheKey: string) => {
    const [eventosResult, vendasResult] = await Promise.all([
      supabase.from('eventos_prospeccao').select('contato_id').eq('prospeccao_id', eventoId),
      supabase.from('vendas_prospeccao').select('contato_id').eq('empresa_id', empresaId),
    ]);

    const contatoIds = [...new Set((eventosResult.data || []).map(ep => ep.contato_id).filter(Boolean))] as string[];
    const contatosComCompra = new Set((vendasResult.data || []).map(v => v.contato_id));

    if (contatoIds.length === 0) {
      const empty = { clientes: [], kpis: { total: 0, comTelefone: 0, comEmail: 0, realizaramCompra: 0 }, genero: { masculino: 0, feminino: 0, naoInformado: 0 }, documento: { cpf: 0, cnpj: 0, naoInformado: 0 } };
      cacheRef.current.set(cacheKey, { data: empty, timestamp: Date.now() });
      setClientes([]);
      setKpis(empty.kpis);
      setDistribuicaoGenero(empty.genero);
      setDistribuicaoDocumento(empty.documento);
      return;
    }

    // Batch fetch
    const IN_BATCH_SIZE = 200;
    const batches = [];
    for (let i = 0; i < Math.min(contatoIds.length, 1000); i += IN_BATCH_SIZE) {
      batches.push(
        supabase.from('contatos').select('id, nome, telefone, email, responsavel_email, vendedor_nome, created_at').in('id', contatoIds.slice(i, i + IN_BATCH_SIZE)).eq('empresa_id', empresaId)
      );
    }

    const batchResults = await Promise.all(batches);
    let contatosList: any[] = [];
    batchResults.forEach(r => { if (r.data) contatosList.push(...r.data); });
    contatosList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const uniqueContatos = deduplicateByPhone(contatosList);
    const clientesFormatted = uniqueContatos.map(c => formatContato(c, contatosComCompra));

    const newKpis = {
      total: uniqueContatos.length,
      comTelefone: uniqueContatos.filter(c => c.telefone).length,
      comEmail: uniqueContatos.filter(c => c.email).length,
      realizaramCompra: uniqueContatos.filter(c => contatosComCompra.has(c.id)).length,
    };
    const genero = { masculino: 0, feminino: 0, naoInformado: uniqueContatos.length };
    const documento = { cpf: 0, cnpj: 0, naoInformado: uniqueContatos.length };

    cacheRef.current.set(cacheKey, { data: { clientes: clientesFormatted, kpis: newKpis, genero, documento }, timestamp: Date.now() });
    setClientes(clientesFormatted);
    setKpis(newKpis);
    setDistribuicaoGenero(genero);
    setDistribuicaoDocumento(documento);
  };

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const refetch = useCallback(() => {
    // Invalidate cache on manual refetch
    const cacheKey = `${activeCompany?.id}-${prospeccaoId}`;
    cacheRef.current.delete(cacheKey);
    return fetchClientes();
  }, [fetchClientes, activeCompany?.id, prospeccaoId]);

  return { clientes, kpis, distribuicaoGenero, distribuicaoDocumento, loading, refetch };
}
