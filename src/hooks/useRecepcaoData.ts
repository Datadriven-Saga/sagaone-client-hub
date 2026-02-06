import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { 
  extractPhoneDigits, 
  generatePhoneVariations as generateVariations,
  phonesAreEqual,
  formatPhoneForDisplay
} from "@/lib/phoneUtils";

export interface RecepcaoVisita {
  id: string;
  nome_cliente: string;
  telefone_cliente: string;
  nome_campanha: string;
  empresa_id: string;
  data_hora_visita: string;
  created_at: string;
  id_maia?: string;
}

export interface NovaVisita {
  nome_cliente: string;
  telefone_cliente: string;
  nome_campanha: string;
  empresa_id: string;
  id_maia?: string;
}

export interface Prospeccao {
  id: string;
  titulo: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  empresa_id?: string;
  ativo?: boolean;
}

export interface ContatoEncontrado {
  id: string;
  nome: string;
  telefone: string | null;
  status: string | null;
  empresa_id: string;
  evento_id?: string;
  evento_nome?: string;
}

export interface CheckinData {
  telefone: string;
  evento_id: string;
  evento_nome?: string;
  contato?: ContatoEncontrado | null;
  isNewContact: boolean;
}

// Usa a função centralizada de phoneUtils
const normalizePhone = (phone: string): string => {
  return extractPhoneDigits(phone);
};

// Usa a função centralizada de phoneUtils
const generatePhoneVariations = (phone: string): string[] => {
  return generateVariations(phone);
};

// Usa a função centralizada de phoneUtils
const phonesMatch = (phone1: string, phone2: string): boolean => {
  // Primeiro tenta match exato via phoneUtils
  if (phonesAreEqual(phone1, phone2)) return true;
  
  // Fallback: gera variações para compatibilidade com números antigos (10 dígitos)
  const variations1 = generatePhoneVariations(phone1);
  let normalized2 = extractPhoneDigits(phone2);
  
  // Remove código do país do phone2 se presente
  if (normalized2.startsWith('55') && normalized2.length > 11) {
    normalized2 = normalized2.substring(2);
  }
  
  return variations1.includes(normalized2);
};

export const useRecepcaoData = () => {
  const [visitas, setVisitas] = useState<RecepcaoVisita[]>([]);
  const [totalVisitas, setTotalVisitas] = useState(0);
  const [prospeccoes, setProspeccoes] = useState<Prospeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { toast } = useToast();

  // Filter/pagination state
  const [recepcaoEventoFilter, setRecepcaoEventoFilter] = useState<string>("none"); // "none" | "todos" | prospeccao_id
  const [recepcaoStatusFilter, setRecepcaoStatusFilter] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [recepcaoPage, setRecepcaoPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchVisitas = async () => {
    if (!activeCompany) return;

    // If no event selected, don't fetch
    if (recepcaoEventoFilter === "none") {
      setVisitas([]);
      setTotalVisitas(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // If filtering by specific event or all, determine which prospeccao_ids to use
      let prospeccaoIds: string[] | null = null;

      if (recepcaoEventoFilter !== "todos") {
        // Specific event
        prospeccaoIds = [recepcaoEventoFilter];
      } else if (recepcaoStatusFilter !== "todos") {
        // "todos" but filtered by active/inactive status
        const { data: filteredProspeccoes } = await supabase
          .from("prospeccoes")
          .select("id")
          .eq("empresa_id", activeCompany.id)
          .eq("ativo", recepcaoStatusFilter === "ativos");
        
        prospeccaoIds = (filteredProspeccoes || []).map(p => p.id);
        if (prospeccaoIds.length === 0) {
          setVisitas([]);
          setTotalVisitas(0);
          setLoading(false);
          return;
        }
      }

      // Count total
      let countQuery = supabase
        .from("recepcao_visitas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", activeCompany.id);

      if (prospeccaoIds) {
        countQuery = countQuery.in("prospeccao_id", prospeccaoIds);
      }

      const { count } = await countQuery;
      setTotalVisitas(count || 0);

      // Fetch page
      const from = (recepcaoPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from("recepcao_visitas")
        .select("*")
        .eq("empresa_id", activeCompany.id)
        .order("data_hora_visita", { ascending: false })
        .range(from, to);

      if (prospeccaoIds) {
        dataQuery = dataQuery.in("prospeccao_id", prospeccaoIds);
      }

      const { data, error } = await dataQuery;
      if (error) throw error;

      setVisitas(data || []);
    } catch (error) {
      console.error("Erro ao buscar visitas:", error);
      toast({
        title: "Erro ao carregar visitas",
        description: "Não foi possível carregar a lista de visitas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProspeccoes = async () => {
    if (!activeCompany) return;

    try {
      const { data, error } = await supabase
        .from("prospeccoes")
        .select("id, titulo, data_inicio, data_fim, empresa_id, ativo")
        .eq("empresa_id", activeCompany.id)
        .order("data_inicio", { ascending: false });

      if (error) throw error;

      setProspeccoes(data || []);
    } catch (error) {
      console.error("Erro ao buscar prospecções:", error);
    }
  };

  useEffect(() => {
    fetchProspeccoes();
  }, [activeCompany, user]);

  useEffect(() => {
    fetchVisitas();
  }, [activeCompany, user, recepcaoEventoFilter, recepcaoStatusFilter, recepcaoPage]);

  // Reset page when filters change
  useEffect(() => {
    setRecepcaoPage(1);
  }, [recepcaoEventoFilter, recepcaoStatusFilter]);

  // Buscar contato por telefone dentro de um evento específico
  const buscarContatoPorTelefoneEvento = async (
    telefone: string, 
    eventoId: string
  ): Promise<ContatoEncontrado | null> => {
    if (!activeCompany) return null;

    const phoneNormalized = normalizePhone(telefone);
    
    try {
      // Buscar contatos vinculados ao evento via eventos_prospeccao
      const { data: eventosData, error: eventosError } = await supabase
        .from("eventos_prospeccao")
        .select(`
          contato_id,
          prospeccao_id,
          contatos!inner (
            id,
            nome,
            telefone,
            status,
            empresa_id
          ),
          prospeccoes!inner (
            id,
            titulo
          )
        `)
        .eq("prospeccao_id", eventoId);

      if (eventosError) throw eventosError;

      // Procurar contato com telefone correspondente (usando variações do 9º dígito)
      if (eventosData) {
        for (const evento of eventosData) {
          const contato = evento.contatos as any;
          if (contato && contato.telefone && phonesMatch(telefone, contato.telefone)) {
            return {
              id: contato.id,
              nome: contato.nome,
              telefone: contato.telefone,
              status: contato.status,
              empresa_id: contato.empresa_id,
              evento_id: eventoId,
              evento_nome: (evento.prospeccoes as any)?.titulo
            };
          }
        }
      }

      // Se não encontrou no evento, buscar na tabela contatos da empresa
      const { data: contatosData, error: contatosError } = await supabase
        .from("contatos")
        .select("id, nome, telefone, status, empresa_id")
        .eq("empresa_id", activeCompany.id);

      if (contatosError) throw contatosError;

      // Procurar por telefone (usando variações do 9º dígito)
      if (contatosData) {
        const contatoEncontrado = contatosData.find(c => 
          c.telefone && phonesMatch(telefone, c.telefone)
        );
        
        if (contatoEncontrado) {
          // Buscar nome do evento
          const { data: prospeccaoData } = await supabase
            .from("prospeccoes")
            .select("titulo")
            .eq("id", eventoId)
            .single();

          return {
            ...contatoEncontrado,
            evento_id: eventoId,
            evento_nome: prospeccaoData?.titulo
          };
        }
      }

      return null;
    } catch (error) {
      console.error("Erro ao buscar contato:", error);
      return null;
    }
  };

  // Verificar se já existe check-in para este telefone neste evento
  const verificarCheckinExistente = async (
    telefone: string,
    eventoId: string
  ): Promise<boolean> => {
    if (!activeCompany) return false;

    try {
      // Gerar variações do telefone
      const variations = generatePhoneVariations(telefone);

      // Buscar visitas existentes para o mesmo evento
      const { data: visitasExistentes, error } = await supabase
        .from("recepcao_visitas")
        .select("id, telefone_cliente")
        .eq("prospeccao_id", eventoId)
        .eq("empresa_id", activeCompany.id);

      if (error || !visitasExistentes) return false;

      // Verificar se algum telefone existente bate com as variações
      return visitasExistentes.some(visita => {
        const visitaPhone = normalizePhone(visita.telefone_cliente || '');
        let cleanVisitaPhone = visitaPhone;
        if (cleanVisitaPhone.startsWith('55') && cleanVisitaPhone.length > 11) {
          cleanVisitaPhone = cleanVisitaPhone.substring(2);
        }
        return variations.includes(cleanVisitaPhone);
      });
    } catch (error) {
      console.error("Erro ao verificar check-in existente:", error);
      return false;
    }
  };

  // Registrar check-in (atualiza contato existente ou cria novo)
  const registrarCheckin = async (data: CheckinData): Promise<boolean> => {
    if (!activeCompany) return false;

    try {
      // Verificar se já existe check-in para este telefone neste evento
      const jaExisteCheckin = await verificarCheckinExistente(data.telefone, data.evento_id);

      if (jaExisteCheckin) {
        toast({
          title: "Check-in já realizado",
          description: "Este telefone já fez check-in neste evento.",
          variant: "destructive",
        });
        return false;
      }

      const phoneNormalized = normalizePhone(data.telefone);
      let contatoId: string;
      let nomeContato = data.contato?.nome || "Visitante";

      if (data.contato && !data.isNewContact) {
        // Atualizar contato existente para Check-in
        contatoId = data.contato.id;
        const { error: updateError } = await supabase
          .from("contatos")
          .update({
            status: "Check-in" as any,
            updated_at: new Date().toISOString()
          })
          .eq("id", contatoId);

        if (updateError) throw updateError;
      } else {
        // Criar novo contato com status Check-in
        const { data: newContato, error: insertError } = await supabase
          .from("contatos")
          .insert([{
            nome: "Visitante",
            telefone: data.telefone,
            empresa_id: activeCompany.id,
            status: "Check-in" as any,
            origem: "Outros" as any,
            observacoes: `Check-in via Recepção - Evento: ${data.evento_nome || 'N/A'}`
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        
        contatoId = newContato.id;
        nomeContato = "Visitante";

        // Vincular ao evento via eventos_prospeccao
        await supabase
          .from("eventos_prospeccao")
          .insert([{
            contato_id: contatoId,
            prospeccao_id: data.evento_id,
            tipo_evento: "Outro" as any,
            descricao: "Check-in via Recepção"
          }]);
      }

      // Registrar log de movimentação
      await supabase
        .from("logs_movimentacao_contatos")
        .insert([{
          contato_id: contatoId,
          prospeccao_id: data.evento_id,
          status_anterior: data.contato?.status || null,
          status_novo: "Check-in",
          observacoes: `Check-in via Recepção - Evento: ${data.evento_nome || 'N/A'}`
        }]);

      // Registrar na tabela recepcao_visitas com prospeccao_id
      await supabase
        .from("recepcao_visitas")
        .insert([{
          nome_cliente: nomeContato,
          telefone_cliente: data.telefone,
          nome_campanha: data.evento_nome || "Evento",
          empresa_id: activeCompany.id,
          prospeccao_id: data.evento_id
        }]);

      toast({
        title: "Check-in realizado!",
        description: data.isNewContact 
          ? "Novo visitante registrado com sucesso."
          : `${nomeContato} fez check-in.`,
      });

      await fetchVisitas();
      return true;
    } catch (error) {
      console.error("Erro ao registrar check-in:", error);
      toast({
        title: "Erro ao registrar check-in",
        description: "Não foi possível registrar o check-in.",
        variant: "destructive",
      });
      return false;
    }
  };

  const adicionarVisita = async (novaVisita: NovaVisita): Promise<void> => {
    try {
      // 1. Inserir a visita na tabela recepcao_visitas
      const { data, error } = await supabase
        .from("recepcao_visitas")
        .insert([novaVisita])
        .select()
        .single();

      if (error) throw error;

      // 2. Buscar contato existente com o mesmo telefone
      const { data: contatosExistentes, error: searchError } = await supabase
        .from("contatos")
        .select("id, status")
        .eq("empresa_id", novaVisita.empresa_id)
        .eq("telefone", novaVisita.telefone_cliente);

      if (searchError) throw searchError;

      if (contatosExistentes && contatosExistentes.length > 0) {
        // 3a. Se existe, atualizar status para Check-in
        const contatoId = contatosExistentes[0].id;
        const { error: updateError } = await supabase
          .from("contatos")
          .update({ 
            status: "Check-in" as any,
            updated_at: new Date().toISOString() 
          })
          .eq("id", contatoId);

        if (updateError) throw updateError;

        toast({
          title: "Visita registrada",
          description: "Cliente movido para Check-in no Kanban.",
        });
      } else {
        // 3b. Se não existe, criar novo contato com status Check-in
        const { error: insertError } = await supabase
          .from("contatos")
          .insert([{
            nome: novaVisita.nome_cliente,
            telefone: novaVisita.telefone_cliente,
            empresa_id: novaVisita.empresa_id,
            status: "Check-in" as any,
            origem: "Outros" as any,
            observacoes: `Visita registrada via recepção - Campanha: ${novaVisita.nome_campanha}`
          }]);

        if (insertError) throw insertError;

        toast({
          title: "Visita registrada",
          description: "Novo cliente criado na coluna Check-in do Kanban.",
        });
      }

      await fetchVisitas();
    } catch (error) {
      console.error("Erro ao adicionar visita:", error);
      toast({
        title: "Erro ao registrar visita",
        description: "Não foi possível registrar a visita.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const excluirVisita = async (visitaId: string) => {
    try {
      const { error } = await supabase
        .from("recepcao_visitas")
        .delete()
        .eq("id", visitaId);

      if (error) throw error;

      toast({
        title: "Visita excluída",
        description: "A visita foi removida com sucesso.",
      });

      await fetchVisitas();
    } catch (error) {
      console.error("Erro ao excluir visita:", error);
      toast({
        title: "Erro ao excluir visita",
        description: "Não foi possível excluir a visita.",
        variant: "destructive",
      });
    }
  };

  // Validar se um evento existe e pertence à empresa
  const validarEvento = async (eventoId: string): Promise<Prospeccao | null> => {
    if (!activeCompany) return null;

    try {
      const { data, error } = await supabase
        .from("prospeccoes")
        .select("id, titulo, data_inicio, data_fim, empresa_id")
        .eq("id", eventoId)
        .eq("empresa_id", activeCompany.id)
        .single();

      if (error || !data) return null;

      return data;
    } catch (error) {
      console.error("Erro ao validar evento:", error);
      return null;
    }
  };

  return {
    visitas,
    totalVisitas,
    prospeccoes,
    loading,
    adicionarVisita,
    excluirVisita,
    buscarContatoPorTelefoneEvento,
    registrarCheckin,
    validarEvento,
    refetch: fetchVisitas,
    // Filter/pagination
    recepcaoEventoFilter,
    setRecepcaoEventoFilter,
    recepcaoStatusFilter,
    setRecepcaoStatusFilter,
    recepcaoPage,
    setRecepcaoPage,
    PAGE_SIZE,
  };
};
