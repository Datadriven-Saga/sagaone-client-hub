import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { toast } from "sonner";

// Types
export interface AcademyMetrics {
  user_id: string;
  total_treinamentos_disponiveis: number;
  treinamentos_concluidos: number;
  treinamentos_em_andamento: number;
  total_simulacoes_realizadas: number;
  media_geral: number;
  media_situacao: number;
  media_problema: number;
  media_implicacao: number;
  media_negociacao: number;
  media_fechamento: number;
  pontuacao_ranking: number;
  posicao_ranking: number | null;
  tempo_total_minutos: number;
  updated_at: string;
}

export interface AcademyTreinamento {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: string;
  nivel: string | null;
  obrigatorio: boolean | null;
  duracao_estimada_minutos: number | null;
  empresa_id: string | null;
  publico_alvo: unknown;
  tags: unknown;
  conteudo: unknown;
  created_at: string;
  updated_at: string;
}

export interface AcademySimulacao {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  ativo: boolean | null;
  cenario: unknown;
  criterios_avaliacao: unknown;
  config_voz: unknown;
  empresa_id: string | null;
  treinamento_id: string | null;
  created_at: string;
}

export interface CriterioAvaliacao {
  dimensao: string;
  peso: number;
  itens: { pergunta: string; peso: number }[];
}

export interface AcademySessao {
  id: string;
  simulacao_id: string;
  user_id: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
  duracao_segundos: number | null;
  nota_final: number | null;
  avaliacoes: unknown;
  transcricao: unknown;
  feedback_ia: string | null;
  pontos_fortes: unknown;
  pontos_melhoria: unknown;
}

export interface TranscricaoItem {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface AcademyRecomendacao {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  referencia_tipo: string | null;
  referencia_id: string | null;
  prioridade: number;
  contexto: Record<string, unknown> | null;
  visualizada: boolean;
  acionada: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface AcademyProgresso {
  id: string;
  user_id: string;
  treinamento_id: string;
  modulo_id: string | null;
  status: string;
  percentual_concluido: number;
  nota: number | null;
  tentativas: number;
  tempo_gasto_minutos: number;
  data_inicio: string | null;
  data_conclusao: string | null;
}

// Hook for user metrics
export function useAcademyMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["academy-metrics", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("academy_metricas_usuario")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // Return default metrics if none exist
      if (!data) {
        return {
          user_id: user.id,
          total_treinamentos_disponiveis: 0,
          treinamentos_concluidos: 0,
          treinamentos_em_andamento: 0,
          total_simulacoes_realizadas: 0,
          media_geral: 0,
          media_situacao: 0,
          media_problema: 0,
          media_implicacao: 0,
          media_negociacao: 0,
          media_fechamento: 0,
          pontuacao_ranking: 0,
          posicao_ranking: null,
          tempo_total_minutos: 0,
          updated_at: new Date().toISOString(),
        } as AcademyMetrics;
      }

      return data as AcademyMetrics;
    },
    enabled: !!user?.id,
  });
}

// Hook for radar chart data
export function useAcademyRadarData() {
  const { data: metrics } = useAcademyMetrics();

  const radarData = [
    { dimension: "Situação", score: Number(metrics?.media_situacao || 0), fullMark: 10 },
    { dimension: "Problema", score: Number(metrics?.media_problema || 0), fullMark: 10 },
    { dimension: "Implicação", score: Number(metrics?.media_implicacao || 0), fullMark: 10 },
    { dimension: "Negociação e Objeção", score: Number(metrics?.media_negociacao || 0), fullMark: 10 },
    { dimension: "Fechamento", score: Number(metrics?.media_fechamento || 0), fullMark: 10 },
  ];

  const dimensionScores = [
    { name: "Situação", score: Number(metrics?.media_situacao || 0), color: getScoreColor(Number(metrics?.media_situacao || 0)) },
    { name: "Problema", score: Number(metrics?.media_problema || 0), color: getScoreColor(Number(metrics?.media_problema || 0)) },
    { name: "Implicação", score: Number(metrics?.media_implicacao || 0), color: getScoreColor(Number(metrics?.media_implicacao || 0)) },
    { name: "Negociação e Objeção", score: Number(metrics?.media_negociacao || 0), color: getScoreColor(Number(metrics?.media_negociacao || 0)) },
    { name: "Fechamento", score: Number(metrics?.media_fechamento || 0), color: getScoreColor(Number(metrics?.media_fechamento || 0)) },
  ];

  return { radarData, dimensionScores, metrics };
}

function getScoreColor(score: number): string {
  if (score >= 7) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 5) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

// Hook for trainings
export function useAcademyTreinamentos() {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ["academy-treinamentos", activeCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_treinamentos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AcademyTreinamento[];
    },
  });
}

// Hook for simulations
export function useAcademySimulacoes(tipo?: string) {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ["academy-simulacoes", activeCompany?.id, tipo],
    queryFn: async () => {
      let query = supabase
        .from("academy_simulacoes")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (tipo) {
        query = query.eq("tipo", tipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AcademySimulacao[];
    },
  });
}

// Hook for user's simulation sessions
export function useAcademySessoes(limit?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["academy-sessoes", user?.id, limit],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("academy_sessoes_simulacao")
        .select(`
          *,
          simulacao:simulacao_id (
            titulo,
            tipo,
            descricao
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Hook for user's recommendations
export function useAcademyRecomendacoes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["academy-recomendacoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("academy_recomendacoes")
        .select("*")
        .eq("user_id", user.id)
        .eq("visualizada", false)
        .order("prioridade", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as AcademyRecomendacao[];
    },
    enabled: !!user?.id,
  });
}

// Hook for user's progress
export function useAcademyProgresso() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["academy-progresso", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("academy_progresso")
        .select(`
          *,
          treinamento:treinamento_id (
            titulo,
            tipo,
            nivel,
            duracao_estimada_minutos
          )
        `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Hook for ranking data
export function useAcademyRanking(limit = 20) {
  const { activeCompany } = useCompany();
  const { isAdminOrTI } = useUserAccessType();

  return useQuery({
    queryKey: ["academy-ranking", activeCompany?.id, limit],
    queryFn: async () => {
      // Get metrics with profile info
      const { data, error } = await supabase
        .from("academy_metricas_usuario")
        .select(`
          *,
          profile:user_id (
            nome_completo,
            departamento,
            tipo_acesso,
            empresa_id,
            empresas:empresa_id (
              nome_empresa
            )
          )
        `)
        .order("pontuacao_ranking", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Add position and filter by company if not admin
      return (data || [])
        .filter((item: any) => {
          if (isAdminOrTI) return true;
          return item.profile?.empresa_id === activeCompany?.id;
        })
        .map((item: any, index: number) => ({
          ...item,
          posicao: index + 1,
        }));
    },
    enabled: !!activeCompany?.id,
  });
}

// Mutations
// Valid types for academy_treinamentos DB constraint
const VALID_TIPOS = ["texto", "audio", "video", "simulacao"] as const;
const VALID_NIVEIS = ["iniciante", "intermediario", "avancado"] as const;

function validateTipo(tipo: string): string {
  const mapping: Record<string, string> = {
    "curso": "texto",
    "simulacao_voz": "simulacao",
    "simulacao_texto": "texto",
    "documento": "texto",
  };
  const mapped = mapping[tipo] || tipo;
  return VALID_TIPOS.includes(mapped as any) ? mapped : "texto";
}

function validateNivel(nivel: string | undefined): string | null {
  if (!nivel) return null;
  return VALID_NIVEIS.includes(nivel as any) ? nivel : "intermediario";
}

export function useCreateTreinamento() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { isAdminOrTI } = useUserAccessType();

  return useMutation({
    mutationFn: async (data: {
      titulo: string;
      descricao?: string;
      tipo: string;
      nivel?: string;
      obrigatorio?: boolean;
      duracao_estimada_minutos?: number;
      prazo_padrao_dias?: number;
      // Voice config for simulations
      personaNome?: string;
      personaGenero?: string;
      vozIA?: string;
    }) => {
      const empresaId = isAdminOrTI ? null : activeCompany?.id || null;
      
      // Validate tipo and nivel to match DB constraints
      const tipoValidado = validateTipo(data.tipo);
      const nivelValidado = validateNivel(data.nivel);
      
      // Build content/config object
      const conteudo: Record<string, any> = {
        prazo_padrao_dias: data.prazo_padrao_dias || 30,
      };
      
      // Add voice config for simulations
      if (tipoValidado === "simulacao") {
        conteudo.config_voz = {
          persona_nome: data.personaNome || "Cliente",
          persona_genero: data.personaGenero || "F",
          voz_openai: data.vozIA || "shimmer",
        };
      }
      
      console.log("[useCreateTreinamento] Inserting with:", {
        tipo: tipoValidado,
        nivel: nivelValidado,
        titulo: data.titulo,
        prazo_padrao_dias: data.prazo_padrao_dias,
      });
      
      const { error } = await supabase.from("academy_treinamentos").insert([{
        titulo: data.titulo,
        descricao: data.descricao || null,
        tipo: tipoValidado,
        nivel: nivelValidado,
        obrigatorio: data.obrigatorio || false,
        duracao_estimada_minutos: data.duracao_estimada_minutos || null,
        empresa_id: empresaId,
        criado_por: user?.id,
        status: "rascunho",
        conteudo,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treinamento criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["academy-treinamentos"] });
    },
    onError: (error) => {
      toast.error("Erro ao criar treinamento: " + error.message);
    },
  });
}

export interface SimulacaoPersona {
  id: string;
  nome: string;
  cargo: string;
  empresa: string;
  dificuldade: string;
  descricao: string;
  objetivo: string;
}

export interface CreateSimulacaoData {
  titulo: string;
  descricao?: string;
  tipo: "voz" | "texto"; // DB constraint: voz or texto only
  cenario?: string;
  objetivo?: string;
  departamento?: string;
  personas: SimulacaoPersona[];
  vozIA?: string;
}

export function useCreateSimulacao() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateSimulacaoData) => {
      // Build cenario object with personas
      const cenario = {
        departamento: data.departamento || "Vendas Novos",
        contexto: data.descricao || "",
        objetivo: data.objetivo || "",
        personas: data.personas.map(p => ({
          id: p.id,
          nome: p.nome,
          cargo: p.cargo,
          empresa: p.empresa,
          dificuldade: p.dificuldade,
          descricao: p.descricao,
          objetivo: p.objetivo,
        })),
      };

      // Build config_voz for voice simulations
      const configVoz = data.tipo === "voz" ? {
        voz_openai: data.vozIA || "shimmer",
      } : null;

      const { error } = await supabase.from("academy_simulacoes").insert([{
        titulo: data.titulo,
        descricao: data.descricao || null,
        tipo: data.tipo, // "voz" or "texto"
        ativo: true,
        empresa_id: activeCompany?.id || null,
        criado_por: user?.id,
        cenario,
        config_voz: configVoz,
        criterios_avaliacao: {
          dimensoes: [
            { nome: "Situação", peso: 20 },
            { nome: "Problema", peso: 20 },
            { nome: "Implicação", peso: 20 },
            { nome: "Negociação e Objeção", peso: 20 },
            { nome: "Fechamento e Próximos Passos", peso: 20 },
          ],
        },
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Simulação criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["academy-simulacoes"] });
    },
    onError: (error) => {
      toast.error("Erro ao criar simulação: " + error.message);
    },
  });
}

export function useStartSessao() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (simulacaoId: string) => {
      const { data, error } = await supabase
        .from("academy_sessoes_simulacao")
        .insert([{
          simulacao_id: simulacaoId,
          user_id: user?.id,
          status: "em_andamento",
          data_inicio: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-sessoes"] });
    },
    onError: (error) => {
      toast.error("Erro ao iniciar sessão: " + error.message);
    },
  });
}

export function useEndSessao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessaoId,
      transcricao,
      avaliacoes,
      notaFinal,
      feedbackIA,
      pontosFortes,
      pontosMelhoria,
    }: {
      sessaoId: string;
      transcricao?: TranscricaoItem[];
      avaliacoes?: Record<string, unknown>;
      notaFinal?: number;
      feedbackIA?: string;
      pontosFortes?: string[];
      pontosMelhoria?: string[];
    }) => {
      const dataFim = new Date().toISOString();
      
      const { error } = await supabase
        .from("academy_sessoes_simulacao")
        .update({
          status: "concluida",
          data_fim: dataFim,
          transcricao: (transcricao || []) as unknown as null,
          avaliacoes: (avaliacoes || {}) as unknown as null,
          nota_final: notaFinal,
          feedback_ia: feedbackIA,
          pontos_fortes: (pontosFortes || []) as unknown as null,
          pontos_melhoria: (pontosMelhoria || []) as unknown as null,
        })
        .eq("id", sessaoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-sessoes"] });
      queryClient.invalidateQueries({ queryKey: ["academy-metrics"] });
    },
    onError: (error) => {
      toast.error("Erro ao finalizar sessão: " + error.message);
    },
  });
}

export function useGenerateRecomendacoes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      // This would call an edge function that uses OpenAI to generate recommendations
      // For now, we'll create mock recommendations based on metrics
      const { data: metrics } = await supabase
        .from("academy_metricas_usuario")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      const recommendations: Partial<AcademyRecomendacao>[] = [];

      // Valid tipos according to DB constraint: 'treinamento', 'simulacao', 'melhoria', 'geral'
      if (!metrics || metrics.total_simulacoes_realizadas === 0) {
        recommendations.push({
          tipo: "simulacao",
          titulo: "Realize sua primeira simulação",
          descricao: "Comece praticando com uma simulação de vendas para identificar seus pontos fortes e áreas de melhoria.",
          prioridade: 10,
        });
      } else {
        // Analyze weak dimensions
        const dimensions = [
          { name: "Situação", score: Number(metrics.media_situacao || 0) },
          { name: "Problema", score: Number(metrics.media_problema || 0) },
          { name: "Implicação", score: Number(metrics.media_implicacao || 0) },
          { name: "Negociação", score: Number(metrics.media_negociacao || 0) },
          { name: "Fechamento", score: Number(metrics.media_fechamento || 0) },
        ].sort((a, b) => a.score - b.score);

        const weakest = dimensions[0];
        if (weakest.score < 5) {
          recommendations.push({
            tipo: "melhoria",
            titulo: `Foco prioritário: ${weakest.name}`,
            descricao: `Sua nota em ${weakest.name} é ${weakest.score.toFixed(1)}. Pratique simulações focadas nesta dimensão para melhorar seu desempenho.`,
            prioridade: 9,
          });
        }

        if (metrics.total_simulacoes_realizadas < 5) {
          recommendations.push({
            tipo: "geral",
            titulo: "Pratique mais simulações",
            descricao: "Realize ao menos 2 simulações por semana para acelerar seu desenvolvimento e melhorar suas notas.",
            prioridade: 7,
          });
        }
      }

      // Insert recommendations
      if (recommendations.length > 0) {
        const insertData = recommendations.map((r) => ({
          tipo: r.tipo!,
          titulo: r.titulo!,
          descricao: r.descricao!,
          prioridade: r.prioridade || 0,
          user_id: user?.id!,
        }));
        
        const { error } = await supabase.from("academy_recomendacoes").insert(insertData);

        if (error) throw error;
      }

      return recommendations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-recomendacoes"] });
      toast.success("Recomendações geradas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao gerar recomendações: " + error.message);
    },
  });
}

// Hook for assigning training to users
export function useAssignTreinamento() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      treinamentoId,
      userId,
      obrigatorio = true,
      dataLimite,
    }: {
      treinamentoId: string;
      userId: string;
      obrigatorio?: boolean;
      dataLimite?: string;
    }) => {
      const { error } = await supabase.from("academy_atribuicoes").insert([{
        treinamento_id: treinamentoId,
        user_id: userId,
        atribuido_por: user?.id,
        obrigatorio,
        data_limite: dataLimite || null,
        status: "pendente",
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treinamento atribuído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["academy-atribuicoes"] });
    },
    onError: (error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Este treinamento já foi atribuído a este usuário.");
      } else {
        toast.error("Erro ao atribuir treinamento: " + error.message);
      }
    },
  });
}

// Hook for user assignments
export function useAcademyAtribuicoes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["academy-atribuicoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("academy_atribuicoes")
        .select(`
          *,
          treinamento:treinamento_id (
            titulo,
            tipo,
            nivel,
            duracao_estimada_minutos
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Hook for all simulation sessions (admin view)
export function useAcademyAllSessoes(filters?: {
  searchTerm?: string;
  tipo?: string;
  page?: number;
  pageSize?: number;
}) {
  const { activeCompany } = useCompany();
  const { isAdminOrTI } = useUserAccessType();
  
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;

  return useQuery({
    queryKey: ["academy-all-sessoes", activeCompany?.id, isAdminOrTI, filters],
    queryFn: async () => {
      let query = supabase
        .from("academy_sessoes_simulacao")
        .select(`
          *,
          simulacao:simulacao_id (
            titulo,
            tipo,
            descricao,
            cenario
          ),
          profile:user_id (
            nome_completo,
            departamento,
            empresa_id
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      
      // Filter by company if not admin
      let filtered = data || [];
      if (!isAdminOrTI && activeCompany?.id) {
        filtered = filtered.filter((s: any) => s.profile?.empresa_id === activeCompany?.id);
      }
      
      // Apply text search
      if (filters?.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filtered = filtered.filter((s: any) => 
          s.id.toLowerCase().includes(term) ||
          s.profile?.nome_completo?.toLowerCase().includes(term) ||
          s.simulacao?.titulo?.toLowerCase().includes(term)
        );
      }
      
      // Apply tipo filter
      if (filters?.tipo && filters.tipo !== "all") {
        filtered = filtered.filter((s: any) => s.simulacao?.tipo === filters.tipo);
      }
      
      return {
        data: filtered,
        total: count || 0,
        page,
        pageSize,
      };
    },
  });
}
