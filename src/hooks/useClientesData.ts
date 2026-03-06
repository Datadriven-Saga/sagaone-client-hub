import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

// Deduplicar contatos por telefone
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

async function fetchAllClientes(empresaId: string) {
  const [countResult, countTelResult, countEmailResult, contatosResult, vendasResult] = await Promise.all([
    supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
    supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).not('telefone', 'is', null).neq('telefone', ''),
    supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).not('email', 'is', null).neq('email', ''),
    supabase.from('contatos').select('id, nome, telefone, email, responsavel_email, vendedor_nome, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(2000),
    supabase.from('vendas_prospeccao').select('contato_id').eq('empresa_id', empresaId),
  ]);

  const contatosList = contatosResult.data || [];
  const contatosComCompra = new Set((vendasResult.data || []).map(v => v.contato_id));
  const uniqueContatos = deduplicateByPhone(contatosList);
  const clientesFormatted = uniqueContatos.map(c => formatContato(c, contatosComCompra));

  const comTelefoneServer = countTelResult.count || 0;
  const kpis = {
    total: uniqueContatos.length,
    comTelefone: comTelefoneServer > uniqueContatos.length ? uniqueContatos.filter(c => c.telefone).length : comTelefoneServer,
    comEmail: countEmailResult.count || 0,
    realizaramCompra: uniqueContatos.filter(c => contatosComCompra.has(c.id)).length,
  };
  const genero = { masculino: 0, feminino: 0, naoInformado: uniqueContatos.length };
  const documento = { cpf: 0, cnpj: 0, naoInformado: uniqueContatos.length };

  return { clientes: clientesFormatted, kpis, genero, documento };
}

async function fetchClientesByEvento(empresaId: string, eventoId: string) {
  const [eventosResult, vendasResult] = await Promise.all([
    supabase.from('eventos_prospeccao').select('contato_id').eq('prospeccao_id', eventoId),
    supabase.from('vendas_prospeccao').select('contato_id').eq('empresa_id', empresaId),
  ]);

  const contatoIds = [...new Set((eventosResult.data || []).map(ep => ep.contato_id).filter(Boolean))] as string[];
  const contatosComCompra = new Set((vendasResult.data || []).map(v => v.contato_id));

  if (contatoIds.length === 0) {
    return {
      clientes: [],
      kpis: { total: 0, comTelefone: 0, comEmail: 0, realizaramCompra: 0 },
      genero: { masculino: 0, feminino: 0, naoInformado: 0 },
      documento: { cpf: 0, cnpj: 0, naoInformado: 0 },
    };
  }

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

  const kpis = {
    total: uniqueContatos.length,
    comTelefone: uniqueContatos.filter(c => c.telefone).length,
    comEmail: uniqueContatos.filter(c => c.email).length,
    realizaramCompra: uniqueContatos.filter(c => contatosComCompra.has(c.id)).length,
  };
  const genero = { masculino: 0, feminino: 0, naoInformado: uniqueContatos.length };
  const documento = { cpf: 0, cnpj: 0, naoInformado: uniqueContatos.length };

  return { clientes: clientesFormatted, kpis, genero, documento };
}

const defaultKpis = { total: 0, comTelefone: 0, comEmail: 0, realizaramCompra: 0 };
const defaultGenero = { masculino: 0, feminino: 0, naoInformado: 0 };
const defaultDocumento = { cpf: 0, cnpj: 0, naoInformado: 0 };

export function useClientesData({ prospeccaoId = "todos" }: UseClientesDataProps = {}) {
  const { activeCompany } = useCompany();
  const empresaId = activeCompany?.id;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clientes', empresaId, prospeccaoId],
    queryFn: () => {
      if (!empresaId) throw new Error('No company');
      return prospeccaoId === "todos"
        ? fetchAllClientes(empresaId)
        : fetchClientesByEvento(empresaId, prospeccaoId);
    },
    enabled: !!empresaId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,    // 5 minutes garbage collection
    refetchOnWindowFocus: false,
  });

  return {
    clientes: data?.clientes ?? [],
    kpis: data?.kpis ?? defaultKpis,
    distribuicaoGenero: data?.genero ?? defaultGenero,
    distribuicaoDocumento: data?.documento ?? defaultDocumento,
    loading: isLoading,
    refetch,
  };
}
