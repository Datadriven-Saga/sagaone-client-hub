export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academy_atribuicoes: {
        Row: {
          atribuido_por: string | null
          created_at: string
          data_limite: string | null
          id: string
          obrigatorio: boolean | null
          prioridade: number | null
          status: string
          treinamento_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          atribuido_por?: string | null
          created_at?: string
          data_limite?: string | null
          id?: string
          obrigatorio?: boolean | null
          prioridade?: number | null
          status?: string
          treinamento_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          atribuido_por?: string | null
          created_at?: string
          data_limite?: string | null
          id?: string
          obrigatorio?: boolean | null
          prioridade?: number | null
          status?: string
          treinamento_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_atribuicoes_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "academy_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_metricas_usuario: {
        Row: {
          id: string
          media_fechamento: number | null
          media_geral: number | null
          media_implicacao: number | null
          media_negociacao: number | null
          media_problema: number | null
          media_situacao: number | null
          pontuacao_ranking: number | null
          posicao_ranking: number | null
          tempo_total_minutos: number | null
          total_simulacoes_realizadas: number | null
          total_treinamentos_disponiveis: number | null
          treinamentos_concluidos: number | null
          treinamentos_em_andamento: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          media_fechamento?: number | null
          media_geral?: number | null
          media_implicacao?: number | null
          media_negociacao?: number | null
          media_problema?: number | null
          media_situacao?: number | null
          pontuacao_ranking?: number | null
          posicao_ranking?: number | null
          tempo_total_minutos?: number | null
          total_simulacoes_realizadas?: number | null
          total_treinamentos_disponiveis?: number | null
          treinamentos_concluidos?: number | null
          treinamentos_em_andamento?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          media_fechamento?: number | null
          media_geral?: number | null
          media_implicacao?: number | null
          media_negociacao?: number | null
          media_problema?: number | null
          media_situacao?: number | null
          pontuacao_ranking?: number | null
          posicao_ranking?: number | null
          tempo_total_minutos?: number | null
          total_simulacoes_realizadas?: number | null
          total_treinamentos_disponiveis?: number | null
          treinamentos_concluidos?: number | null
          treinamentos_em_andamento?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      academy_modulos: {
        Row: {
          conteudo: Json | null
          created_at: string
          descricao: string | null
          duracao_estimada_minutos: number | null
          id: string
          obrigatorio: boolean | null
          ordem: number
          tipo: string
          titulo: string
          treinamento_id: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json | null
          created_at?: string
          descricao?: string | null
          duracao_estimada_minutos?: number | null
          id?: string
          obrigatorio?: boolean | null
          ordem?: number
          tipo: string
          titulo: string
          treinamento_id: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json | null
          created_at?: string
          descricao?: string | null
          duracao_estimada_minutos?: number | null
          id?: string
          obrigatorio?: boolean | null
          ordem?: number
          tipo?: string
          titulo?: string
          treinamento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_modulos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "academy_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_progresso: {
        Row: {
          created_at: string
          dados_progresso: Json | null
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          modulo_id: string | null
          nota: number | null
          percentual_concluido: number | null
          status: string
          tempo_gasto_minutos: number | null
          tentativas: number | null
          treinamento_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados_progresso?: Json | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          modulo_id?: string | null
          nota?: number | null
          percentual_concluido?: number | null
          status?: string
          tempo_gasto_minutos?: number | null
          tentativas?: number | null
          treinamento_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados_progresso?: Json | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          modulo_id?: string | null
          nota?: number | null
          percentual_concluido?: number | null
          status?: string
          tempo_gasto_minutos?: number | null
          tentativas?: number | null
          treinamento_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_progresso_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "academy_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_progresso_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "academy_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_recomendacoes: {
        Row: {
          acionada: boolean | null
          contexto: Json | null
          created_at: string
          descricao: string
          expires_at: string | null
          id: string
          prioridade: number | null
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          titulo: string
          user_id: string
          visualizada: boolean | null
        }
        Insert: {
          acionada?: boolean | null
          contexto?: Json | null
          created_at?: string
          descricao: string
          expires_at?: string | null
          id?: string
          prioridade?: number | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: string
          titulo: string
          user_id: string
          visualizada?: boolean | null
        }
        Update: {
          acionada?: boolean | null
          contexto?: Json | null
          created_at?: string
          descricao?: string
          expires_at?: string | null
          id?: string
          prioridade?: number | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
          visualizada?: boolean | null
        }
        Relationships: []
      }
      academy_sessoes_simulacao: {
        Row: {
          avaliacoes: Json | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          duracao_segundos: number | null
          feedback_ia: string | null
          id: string
          nota_final: number | null
          pontos_fortes: Json | null
          pontos_melhoria: Json | null
          simulacao_id: string
          status: string
          transcricao: Json | null
          user_id: string
        }
        Insert: {
          avaliacoes?: Json | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          duracao_segundos?: number | null
          feedback_ia?: string | null
          id?: string
          nota_final?: number | null
          pontos_fortes?: Json | null
          pontos_melhoria?: Json | null
          simulacao_id: string
          status?: string
          transcricao?: Json | null
          user_id: string
        }
        Update: {
          avaliacoes?: Json | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          duracao_segundos?: number | null
          feedback_ia?: string | null
          id?: string
          nota_final?: number | null
          pontos_fortes?: Json | null
          pontos_melhoria?: Json | null
          simulacao_id?: string
          status?: string
          transcricao?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_sessoes_simulacao_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "academy_simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_simulacoes: {
        Row: {
          ativo: boolean | null
          cenario: Json
          config_voz: Json | null
          created_at: string
          criado_por: string | null
          criterios_avaliacao: Json
          descricao: string | null
          empresa_id: string | null
          id: string
          tipo: string
          titulo: string
          treinamento_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cenario?: Json
          config_voz?: Json | null
          created_at?: string
          criado_por?: string | null
          criterios_avaliacao?: Json
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tipo: string
          titulo: string
          treinamento_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cenario?: Json
          config_voz?: Json | null
          created_at?: string
          criado_por?: string | null
          criterios_avaliacao?: Json
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tipo?: string
          titulo?: string
          treinamento_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_simulacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_simulacoes_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "academy_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_treinamentos: {
        Row: {
          conteudo: Json | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          duracao_estimada_minutos: number | null
          empresa_id: string | null
          fonte_externa: string | null
          formato_original: string | null
          id: string
          nivel: string | null
          obrigatorio: boolean | null
          ordem: number | null
          publico_alvo: Json | null
          status: string
          tags: Json | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          duracao_estimada_minutos?: number | null
          empresa_id?: string | null
          fonte_externa?: string | null
          formato_original?: string | null
          id?: string
          nivel?: string | null
          obrigatorio?: boolean | null
          ordem?: number | null
          publico_alvo?: Json | null
          status?: string
          tags?: Json | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          duracao_estimada_minutos?: number | null
          empresa_id?: string | null
          fonte_externa?: string | null
          formato_original?: string | null
          id?: string
          nivel?: string | null
          obrigatorio?: boolean | null
          ordem?: number | null
          publico_alvo?: Json | null
          status?: string
          tags?: Json | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_cadencias: {
        Row: {
          agente_id: string
          ativo: boolean
          created_at: string
          delay_inicial_minutos: number
          dias_semana: Json
          empresa_id: string | null
          gatilho_cadencia: string
          horario_fim: string
          horario_inicio: string
          id: string
          intervalo_etapas_minutos: number
          quantidade_etapas: number
          timezone: string
          tipo_cadencia: string
          updated_at: string
        }
        Insert: {
          agente_id: string
          ativo?: boolean
          created_at?: string
          delay_inicial_minutos?: number
          dias_semana?: Json
          empresa_id?: string | null
          gatilho_cadencia?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_etapas_minutos?: number
          quantidade_etapas?: number
          timezone?: string
          tipo_cadencia?: string
          updated_at?: string
        }
        Update: {
          agente_id?: string
          ativo?: boolean
          created_at?: string
          delay_inicial_minutos?: number
          dias_semana?: Json
          empresa_id?: string | null
          gatilho_cadencia?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_etapas_minutos?: number
          quantidade_etapas?: number
          timezone?: string
          tipo_cadencia?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_cadencias_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_cadencias_steps: {
        Row: {
          agente_id: string
          ativa: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          intervalo_minutos: number
          mensagem_enviada: string | null
          nome_cadencia: string
          ordem: number
          tipo_disparo: string
          tipo_mensagem: string
          updated_at: string
        }
        Insert: {
          agente_id: string
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          intervalo_minutos?: number
          mensagem_enviada?: string | null
          nome_cadencia: string
          ordem: number
          tipo_disparo: string
          tipo_mensagem: string
          updated_at?: string
        }
        Update: {
          agente_id?: string
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          intervalo_minutos?: number
          mensagem_enviada?: string | null
          nome_cadencia?: string
          ordem?: number
          tipo_disparo?: string
          tipo_mensagem?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_cadencias_steps_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_empresas: {
        Row: {
          agente_id: string
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["status_agente_empresa"]
          updated_at: string | null
        }
        Insert: {
          agente_id: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_agente_empresa"]
          updated_at?: string | null
        }
        Update: {
          agente_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_agente_empresa"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_empresas_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_followups: {
        Row: {
          acoes: Json | null
          agente_id: string
          ativo: boolean
          condicoes: Json | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          acoes?: Json | null
          agente_id: string
          ativo?: boolean
          condicoes?: Json | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          acoes?: Json | null
          agente_id?: string
          ativo?: boolean
          condicoes?: Json | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_followups_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_integracoes: {
        Row: {
          agente_id: string
          ativo: boolean
          banco_dados_ia: string | null
          created_at: string
          empresa_id: string | null
          evolution_id: string | null
          id: string
          tabela_historico_ia: string | null
          updated_at: string
          webhook_metodo: string
          webhook_url: string | null
        }
        Insert: {
          agente_id: string
          ativo?: boolean
          banco_dados_ia?: string | null
          created_at?: string
          empresa_id?: string | null
          evolution_id?: string | null
          id?: string
          tabela_historico_ia?: string | null
          updated_at?: string
          webhook_metodo?: string
          webhook_url?: string | null
        }
        Update: {
          agente_id?: string
          ativo?: boolean
          banco_dados_ia?: string | null
          created_at?: string
          empresa_id?: string | null
          evolution_id?: string | null
          id?: string
          tabela_historico_ia?: string | null
          updated_at?: string
          webhook_metodo?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_integracoes_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_performance: {
        Row: {
          agente_id: string
          cadencias_executadas: number
          created_at: string
          data_registro: string
          empresa_id: string | null
          followups_executados: number
          id: string
        }
        Insert: {
          agente_id: string
          cadencias_executadas?: number
          created_at?: string
          data_registro?: string
          empresa_id?: string | null
          followups_executados?: number
          id?: string
        }
        Update: {
          agente_id?: string
          cadencias_executadas?: number
          created_at?: string
          data_registro?: string
          empresa_id?: string | null
          followups_executados?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_performance_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_variaveis: {
        Row: {
          agente_id: string
          ativo: boolean
          created_at: string
          descricao: string
          empresa_id: string | null
          id: string
          nome: string
          obrigatorio: boolean
          ordem: number
          updated_at: string
        }
        Insert: {
          agente_id: string
          ativo?: boolean
          created_at?: string
          descricao: string
          empresa_id?: string | null
          id?: string
          nome: string
          obrigatorio?: boolean
          ordem: number
          updated_at?: string
        }
        Update: {
          agente_id?: string
          ativo?: boolean
          created_at?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          obrigatorio?: boolean
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_variaveis_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes_ia: {
        Row: {
          ativo: boolean
          cerebro: string | null
          created_at: string
          criado_por: string | null
          dealer_id: string | null
          empresa_id: string | null
          foto_url: string | null
          id: string
          nome: string
          persona: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cerebro?: string | null
          created_at?: string
          criado_por?: string | null
          dealer_id?: string | null
          empresa_id?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          persona?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cerebro?: string | null
          created_at?: string
          criado_por?: string | null
          dealer_id?: string | null
          empresa_id?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          persona?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agentes_nextip: {
        Row: {
          agente: string
          bu: string | null
          codigo_id: string
          created_at: string
          created_by: string | null
          id: string
          id_aplicativo: string | null
          id_numero: string | null
          instancia: string | null
          loja: string
          marca: string
          nome: string
          numero: string | null
          status_meta: string | null
          uf: string
          updated_at: string
          waba: string | null
        }
        Insert: {
          agente: string
          bu?: string | null
          codigo_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          id_aplicativo?: string | null
          id_numero?: string | null
          instancia?: string | null
          loja: string
          marca: string
          nome: string
          numero?: string | null
          status_meta?: string | null
          uf: string
          updated_at?: string
          waba?: string | null
        }
        Update: {
          agente?: string
          bu?: string | null
          codigo_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          id_aplicativo?: string | null
          id_numero?: string | null
          instancia?: string | null
          loja?: string
          marca?: string
          nome?: string
          numero?: string | null
          status_meta?: string | null
          uf?: string
          updated_at?: string
          waba?: string | null
        }
        Relationships: []
      }
      agentes_visao: {
        Row: {
          ativo: boolean
          created_at: string
          criador: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number
          strategica: boolean
          tipo: string
          tipo_implantacao: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criador?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          strategica?: boolean
          tipo: string
          tipo_implantacao?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criador?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          strategica?: boolean
          tipo?: string
          tipo_implantacao?: string
          updated_at?: string
        }
        Relationships: []
      }
      allowed_login_domains: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          dominio: string
          id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          dominio: string
          id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          dominio?: string
          id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_login_domains_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allowed_login_domains_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bases_importadas: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nome: string
          total_contatos: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nome: string
          total_contatos?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          total_contatos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bases_importadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cadencia_pri_voz: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          empresa_id: string | null
          hora_primeira_tentativa: string | null
          hora_ultima_tentativa: string | null
          id: string
          id_evento: number
          num_tentativas: number | null
          telefone_lead: string
          telefone_pri: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          empresa_id?: string | null
          hora_primeira_tentativa?: string | null
          hora_ultima_tentativa?: string | null
          id?: string
          id_evento: number
          num_tentativas?: number | null
          telefone_lead: string
          telefone_pri?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          empresa_id?: string | null
          hora_primeira_tentativa?: string | null
          hora_ultima_tentativa?: string | null
          id?: string
          id_evento?: number
          num_tentativas?: number | null
          telefone_lead?: string
          telefone_pri?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadencia_pri_voz_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_batches: {
        Row: {
          batch_index: number
          completed_at: string | null
          created_at: string
          error_log: string | null
          id: string
          job_id: string
          lead_ids: Json
          processed_leads: number
          retry_count: number
          started_at: string | null
          status: string
          total_leads: number
          updated_at: string
        }
        Insert: {
          batch_index: number
          completed_at?: string | null
          created_at?: string
          error_log?: string | null
          id?: string
          job_id: string
          lead_ids?: Json
          processed_leads?: number
          retry_count?: number
          started_at?: string | null
          status?: string
          total_leads?: number
          updated_at?: string
        }
        Update: {
          batch_index?: number
          completed_at?: string | null
          created_at?: string
          error_log?: string | null
          id?: string
          job_id?: string
          lead_ids?: Json
          processed_leads?: number
          retry_count?: number
          started_at?: string | null
          status?: string
          total_leads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_batches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "campaign_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_jobs: {
        Row: {
          canal: string
          completed_at: string | null
          created_at: string
          empresa_id: string
          error_message: string | null
          failed_records: number
          id: string
          processed_records: number
          prospeccao_id: string
          quantidade_solicitada: number | null
          started_at: string | null
          status: string
          total_records: number
          updated_at: string
          user_id: string
        }
        Insert: {
          canal: string
          completed_at?: string | null
          created_at?: string
          empresa_id: string
          error_message?: string | null
          failed_records?: number
          id?: string
          processed_records?: number
          prospeccao_id: string
          quantidade_solicitada?: number | null
          started_at?: string | null
          status?: string
          total_records?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          canal?: string
          completed_at?: string | null
          created_at?: string
          empresa_id?: string
          error_message?: string | null
          failed_records?: number
          id?: string
          processed_records?: number
          prospeccao_id?: string
          quantidade_solicitada?: number | null
          started_at?: string | null
          status?: string
          total_records?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_jobs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_jobs_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_tipo_acesso_mapping: {
        Row: {
          cargo_azure: string
          created_at: string | null
          id: string
          tipo_acesso: Database["public"]["Enums"]["tipo_acesso"]
        }
        Insert: {
          cargo_azure: string
          created_at?: string | null
          id?: string
          tipo_acesso: Database["public"]["Enums"]["tipo_acesso"]
        }
        Update: {
          cargo_azure?: string
          created_at?: string | null
          id?: string
          tipo_acesso?: Database["public"]["Enums"]["tipo_acesso"]
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      contato_anotacoes: {
        Row: {
          contato_id: string
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          prospeccao_id: string | null
          usuario_id: string
        }
        Insert: {
          contato_id: string
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          prospeccao_id?: string | null
          usuario_id: string
        }
        Update: {
          contato_id?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          prospeccao_id?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contato_anotacoes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_anotacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_anotacoes_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contato_quarentena: {
        Row: {
          canal: string
          created_at: string
          data_fim_evento: string | null
          desativado: boolean
          desativado_em: string | null
          desativado_por: string | null
          empresa_id: string | null
          evento_nome: string | null
          expira_em: string | null
          id: string
          marca: string | null
          prospeccao_id: string | null
          telefone_normalizado: string
          ultimo_impacto_at: string
          updated_at: string
        }
        Insert: {
          canal?: string
          created_at?: string
          data_fim_evento?: string | null
          desativado?: boolean
          desativado_em?: string | null
          desativado_por?: string | null
          empresa_id?: string | null
          evento_nome?: string | null
          expira_em?: string | null
          id?: string
          marca?: string | null
          prospeccao_id?: string | null
          telefone_normalizado: string
          ultimo_impacto_at?: string
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          data_fim_evento?: string | null
          desativado?: boolean
          desativado_em?: string | null
          desativado_por?: string | null
          empresa_id?: string | null
          evento_nome?: string | null
          expira_em?: string | null
          id?: string
          marca?: string | null
          prospeccao_id?: string | null
          telefone_normalizado?: string
          ultimo_impacto_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contato_quarentena_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_quarentena_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contato_timeline: {
        Row: {
          contato_id: string
          created_at: string
          descricao: string | null
          id: string
          metadata: Json | null
          tipo: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          contato_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          tipo: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          contato_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          tipo?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contato_timeline_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      contatos: {
        Row: {
          agente_ia: string[]
          base_id: string | null
          cliente_id: string | null
          codigo_proposta: string | null
          confirmed_at: string | null
          created_at: string | null
          data_disparo_ia: string | null
          email: string | null
          empresa_id: string
          id: string
          lead_id: number | null
          nome: string
          observacoes: string | null
          origem: Database["public"]["Enums"]["origem_lead"] | null
          qr_code_image: string | null
          qr_token: string | null
          qr_token_used: boolean | null
          qr_token_used_at: string | null
          responsavel_email: string | null
          status: Database["public"]["Enums"]["status_lead"] | null
          telefone: string | null
          tentativas_chamada: number
          updated_at: string | null
          valor_potencial: number | null
          vendedor_nome: string | null
          webhook_ativado: boolean | null
        }
        Insert: {
          agente_ia?: string[]
          base_id?: string | null
          cliente_id?: string | null
          codigo_proposta?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          data_disparo_ia?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          lead_id?: number | null
          nome: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"] | null
          qr_code_image?: string | null
          qr_token?: string | null
          qr_token_used?: boolean | null
          qr_token_used_at?: string | null
          responsavel_email?: string | null
          status?: Database["public"]["Enums"]["status_lead"] | null
          telefone?: string | null
          tentativas_chamada?: number
          updated_at?: string | null
          valor_potencial?: number | null
          vendedor_nome?: string | null
          webhook_ativado?: boolean | null
        }
        Update: {
          agente_ia?: string[]
          base_id?: string | null
          cliente_id?: string | null
          codigo_proposta?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          data_disparo_ia?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          lead_id?: number | null
          nome?: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"] | null
          qr_code_image?: string | null
          qr_token?: string | null
          qr_token_used?: boolean | null
          qr_token_used_at?: string | null
          responsavel_email?: string | null
          status?: Database["public"]["Enums"]["status_lead"] | null
          telefone?: string | null
          tentativas_chamada?: number
          updated_at?: string | null
          valor_potencial?: number | null
          vendedor_nome?: string | null
          webhook_ativado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contatos_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases_importadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_agentes: {
        Row: {
          ativo: boolean
          chamado: string | null
          cnpj: string
          created_at: string
          created_by: string | null
          cronograma: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          implantador: string | null
          loja: string
          marca: string
          nome_agente: string
          numero_telefone: string | null
          observacoes: string | null
          responsavel: string | null
          status: string | null
          telefone_toca: string | null
          tipo_agente: string
          uf: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chamado?: string | null
          cnpj: string
          created_at?: string
          created_by?: string | null
          cronograma?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          implantador?: string | null
          loja: string
          marca: string
          nome_agente: string
          numero_telefone?: string | null
          observacoes?: string | null
          responsavel?: string | null
          status?: string | null
          telefone_toca?: string | null
          tipo_agente: string
          uf: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chamado?: string | null
          cnpj?: string
          created_at?: string
          created_by?: string | null
          cronograma?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          implantador?: string | null
          loja?: string
          marca?: string
          nome_agente?: string
          numero_telefone?: string | null
          observacoes?: string | null
          responsavel?: string | null
          status?: string | null
          telefone_toca?: string | null
          tipo_agente?: string
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controle_agentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_implantacao: {
        Row: {
          agente_visao_id: string | null
          atividade: string
          concluido: boolean
          controle_agente_id: string | null
          created_at: string
          data_inicio: string
          data_termino: string
          id: string
          observacoes: string | null
          responsavel: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          agente_visao_id?: string | null
          atividade: string
          concluido?: boolean
          controle_agente_id?: string | null
          created_at?: string
          data_inicio: string
          data_termino: string
          id?: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          agente_visao_id?: string | null
          atividade?: string
          concluido?: boolean
          controle_agente_id?: string | null
          created_at?: string
          data_inicio?: string
          data_termino?: string
          id?: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_implantacao_agente_visao_id_fkey"
            columns: ["agente_visao_id"]
            isOneToOne: false
            referencedRelation: "agentes_visao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_implantacao_controle_agente_id_fkey"
            columns: ["controle_agente_id"]
            isOneToOne: false
            referencedRelation: "controle_agentes"
            referencedColumns: ["id"]
          },
        ]
      }
      departamento_permissoes: {
        Row: {
          ativo: boolean
          created_at: string
          departamento: string
          id: string
          permissao: string
          updated_at: string
          valor: Json | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          departamento: string
          id?: string
          permissao: string
          updated_at?: string
          valor?: Json | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          departamento?: string
          id?: string
          permissao?: string
          updated_at?: string
          valor?: Json | null
        }
        Relationships: []
      }
      departamentos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          modelo_distribuicao: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          modelo_distribuicao?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          modelo_distribuicao?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_configuracao: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          tamanho_arquivo: number | null
          tipo_arquivo: string | null
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          tamanho_arquivo?: number | null
          tipo_arquivo?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          tamanho_arquivo?: number | null
          tipo_arquivo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_configuracao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_modulos: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          empresa_id: string
          id: string
          modulo_nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          empresa_id: string
          id?: string
          modulo_nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          empresa_id?: string
          id?: string
          modulo_nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cidade: string | null
          cnpj: string
          created_at: string | null
          crm_id: string | null
          endereco: string | null
          grupo_empresarial: string | null
          horario_funcionamento: string | null
          id: string
          logomarca_url: string | null
          marca: string | null
          nome_empresa: string
          responsavel_legal_cpf: string | null
          responsavel_legal_email: string | null
          responsavel_legal_nome: string | null
          responsavel_legal_telefone: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          cidade?: string | null
          cnpj: string
          created_at?: string | null
          crm_id?: string | null
          endereco?: string | null
          grupo_empresarial?: string | null
          horario_funcionamento?: string | null
          id?: string
          logomarca_url?: string | null
          marca?: string | null
          nome_empresa: string
          responsavel_legal_cpf?: string | null
          responsavel_legal_email?: string | null
          responsavel_legal_nome?: string | null
          responsavel_legal_telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string
          created_at?: string | null
          crm_id?: string | null
          endereco?: string | null
          grupo_empresarial?: string | null
          horario_funcionamento?: string | null
          id?: string
          logomarca_url?: string | null
          marca?: string | null
          nome_empresa?: string
          responsavel_legal_cpf?: string | null
          responsavel_legal_email?: string | null
          responsavel_legal_nome?: string | null
          responsavel_legal_telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      evento_snapshot_leads: {
        Row: {
          codigo_proposta: string | null
          contato_id: string | null
          email: string | null
          evento_id: string
          id: string
          nome: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          snapshot_at: string
          status: string
          telefone: string
          vinculado_em: string | null
        }
        Insert: {
          codigo_proposta?: string | null
          contato_id?: string | null
          email?: string | null
          evento_id: string
          id?: string
          nome?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          snapshot_at?: string
          status: string
          telefone: string
          vinculado_em?: string | null
        }
        Update: {
          codigo_proposta?: string | null
          contato_id?: string | null
          email?: string | null
          evento_id?: string
          id?: string
          nome?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          snapshot_at?: string
          status?: string
          telefone?: string
          vinculado_em?: string | null
        }
        Relationships: []
      }
      eventos_pri_voz: {
        Row: {
          atualizado_em: string | null
          categoria: string | null
          cidade: string | null
          criado_em: string | null
          data_fim: string | null
          data_inicio: string | null
          dealerid: string | null
          descricao: string | null
          empresa_id: string | null
          endereco: string | null
          evt_status: string | null
          id: string
          id_evento: number
          marca: string | null
          nome: string
          telefone_pri: string | null
          telefone_pri_whatsapp: string | null
          uf: string | null
        }
        Insert: {
          atualizado_em?: string | null
          categoria?: string | null
          cidade?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dealerid?: string | null
          descricao?: string | null
          empresa_id?: string | null
          endereco?: string | null
          evt_status?: string | null
          id?: string
          id_evento: number
          marca?: string | null
          nome: string
          telefone_pri?: string | null
          telefone_pri_whatsapp?: string | null
          uf?: string | null
        }
        Update: {
          atualizado_em?: string | null
          categoria?: string | null
          cidade?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dealerid?: string | null
          descricao?: string | null
          empresa_id?: string | null
          endereco?: string | null
          evt_status?: string | null
          id?: string
          id_evento?: number
          marca?: string | null
          nome?: string
          telefone_pri?: string | null
          telefone_pri_whatsapp?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_pri_voz_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_prospeccao: {
        Row: {
          confirmation_expires_at: string | null
          confirmation_sent_at: string | null
          confirmation_sent_by: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          contato_id: string | null
          created_at: string | null
          data_disparo_ia: string | null
          data_evento: string | null
          descricao: string | null
          id: string
          observacoes: string | null
          prospeccao_id: string | null
          proximo_contato: string | null
          resultado: string | null
          sincronizado_de_evento_id: string | null
          tipo_evento:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id: string | null
        }
        Insert: {
          confirmation_expires_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_sent_by?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          contato_id?: string | null
          created_at?: string | null
          data_disparo_ia?: string | null
          data_evento?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          prospeccao_id?: string | null
          proximo_contato?: string | null
          resultado?: string | null
          sincronizado_de_evento_id?: string | null
          tipo_evento?:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id?: string | null
        }
        Update: {
          confirmation_expires_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_sent_by?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          contato_id?: string | null
          created_at?: string | null
          data_disparo_ia?: string | null
          data_evento?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          prospeccao_id?: string | null
          proximo_contato?: string | null
          resultado?: string | null
          sincronizado_de_evento_id?: string | null
          tipo_evento?:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_prospeccao_lead_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_prospeccao_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_prospeccao_sincronizado_de_evento_id_fkey"
            columns: ["sincronizado_de_evento_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_prospeccao_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_prospeccao_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_prospeccao_backup_anotacoes: {
        Row: {
          confirmation_expires_at: string | null
          confirmation_sent_at: string | null
          confirmation_sent_by: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          contato_id: string | null
          created_at: string | null
          data_disparo_ia: string | null
          data_evento: string | null
          descricao: string | null
          id: string | null
          observacoes: string | null
          prospeccao_id: string | null
          proximo_contato: string | null
          resultado: string | null
          sincronizado_de_evento_id: string | null
          tipo_evento:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id: string | null
        }
        Insert: {
          confirmation_expires_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_sent_by?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          contato_id?: string | null
          created_at?: string | null
          data_disparo_ia?: string | null
          data_evento?: string | null
          descricao?: string | null
          id?: string | null
          observacoes?: string | null
          prospeccao_id?: string | null
          proximo_contato?: string | null
          resultado?: string | null
          sincronizado_de_evento_id?: string | null
          tipo_evento?:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id?: string | null
        }
        Update: {
          confirmation_expires_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_sent_by?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          contato_id?: string | null
          created_at?: string | null
          data_disparo_ia?: string | null
          data_evento?: string | null
          descricao?: string | null
          id?: string | null
          observacoes?: string | null
          prospeccao_id?: string | null
          proximo_contato?: string | null
          resultado?: string | null
          sincronizado_de_evento_id?: string | null
          tipo_evento?:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      eventos_prospeccao_backup_anotacoes_delta: {
        Row: {
          confirmation_expires_at: string | null
          confirmation_sent_at: string | null
          confirmation_sent_by: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          contato_id: string | null
          created_at: string | null
          data_disparo_ia: string | null
          data_evento: string | null
          descricao: string | null
          id: string | null
          observacoes: string | null
          prospeccao_id: string | null
          proximo_contato: string | null
          resultado: string | null
          sincronizado_de_evento_id: string | null
          tipo_evento:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id: string | null
        }
        Insert: {
          confirmation_expires_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_sent_by?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          contato_id?: string | null
          created_at?: string | null
          data_disparo_ia?: string | null
          data_evento?: string | null
          descricao?: string | null
          id?: string | null
          observacoes?: string | null
          prospeccao_id?: string | null
          proximo_contato?: string | null
          resultado?: string | null
          sincronizado_de_evento_id?: string | null
          tipo_evento?:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id?: string | null
        }
        Update: {
          confirmation_expires_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_sent_by?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          contato_id?: string | null
          created_at?: string | null
          data_disparo_ia?: string | null
          data_evento?: string | null
          descricao?: string | null
          id?: string | null
          observacoes?: string | null
          prospeccao_id?: string | null
          proximo_contato?: string | null
          resultado?: string | null
          sincronizado_de_evento_id?: string | null
          tipo_evento?:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      external_access_seats: {
        Row: {
          created_at: string
          created_by: string
          empresa_id: string
          id: string
          profile_id: string
          prospeccao_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          empresa_id: string
          id?: string
          profile_id: string
          prospeccao_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          empresa_id?: string
          id?: string
          profile_id?: string
          prospeccao_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_access_seats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_access_seats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_access_seats_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_access_seats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_access_seats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_access_seats_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      external_optout_entries: {
        Row: {
          api_id: string | null
          call_optin: boolean | null
          canal_solicitado_do_cliente: string | null
          cargo_solicitante: string | null
          cpf_cliente: string | null
          cpf_normalized: string | null
          data_conclusao: string | null
          data_inicio: string | null
          departamento_solicitante: string | null
          email_cliente: string | null
          email_normalized: string | null
          email_optin: boolean | null
          email_solicitante: string | null
          id: string
          marca: string | null
          marca_api: string
          nome_abreviado_cliente: string | null
          nome_completo_cliente: string | null
          nome_solicitante: string | null
          pesquisa_optin: boolean | null
          phone_normalized: string | null
          sms_optin: boolean | null
          snapshot_id: string
          telefone_cliente: string | null
          telefone_solicitante: string | null
          uf: string
          uf_original: string | null
          whatsapp_optin: boolean | null
        }
        Insert: {
          api_id?: string | null
          call_optin?: boolean | null
          canal_solicitado_do_cliente?: string | null
          cargo_solicitante?: string | null
          cpf_cliente?: string | null
          cpf_normalized?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          departamento_solicitante?: string | null
          email_cliente?: string | null
          email_normalized?: string | null
          email_optin?: boolean | null
          email_solicitante?: string | null
          id?: string
          marca?: string | null
          marca_api: string
          nome_abreviado_cliente?: string | null
          nome_completo_cliente?: string | null
          nome_solicitante?: string | null
          pesquisa_optin?: boolean | null
          phone_normalized?: string | null
          sms_optin?: boolean | null
          snapshot_id: string
          telefone_cliente?: string | null
          telefone_solicitante?: string | null
          uf: string
          uf_original?: string | null
          whatsapp_optin?: boolean | null
        }
        Update: {
          api_id?: string | null
          call_optin?: boolean | null
          canal_solicitado_do_cliente?: string | null
          cargo_solicitante?: string | null
          cpf_cliente?: string | null
          cpf_normalized?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          departamento_solicitante?: string | null
          email_cliente?: string | null
          email_normalized?: string | null
          email_optin?: boolean | null
          email_solicitante?: string | null
          id?: string
          marca?: string | null
          marca_api?: string
          nome_abreviado_cliente?: string | null
          nome_completo_cliente?: string | null
          nome_solicitante?: string | null
          pesquisa_optin?: boolean | null
          phone_normalized?: string | null
          sms_optin?: boolean | null
          snapshot_id?: string
          telefone_cliente?: string | null
          telefone_solicitante?: string | null
          uf?: string
          uf_original?: string | null
          whatsapp_optin?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "external_optout_entries_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "external_optout_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      external_optout_snapshots: {
        Row: {
          fetch_duration_ms: number | null
          fetched_at: string
          fetched_at_date_sp: string
          id: string
          marca_api: string
          status: string
          total_records: number
          uf: string
          valid_until_date_sp: string
        }
        Insert: {
          fetch_duration_ms?: number | null
          fetched_at?: string
          fetched_at_date_sp: string
          id?: string
          marca_api: string
          status?: string
          total_records?: number
          uf: string
          valid_until_date_sp: string
        }
        Update: {
          fetch_duration_ms?: number | null
          fetched_at?: string
          fetched_at_date_sp?: string
          id?: string
          marca_api?: string
          status?: string
          total_records?: number
          uf?: string
          valid_until_date_sp?: string
        }
        Relationships: []
      }
      external_seat_limits: {
        Row: {
          empresa_id: string
          max_seats: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          empresa_id: string
          max_seats?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          empresa_id?: string
          max_seats?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_seat_limits_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_seat_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_seat_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_empresas: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          flag_id: string
          id: string
          is_enabled: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          flag_id: string
          id?: string
          is_enabled?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          flag_id?: string
          id?: string
          is_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flag_empresas_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "system_feature_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_cadence_config: {
        Row: {
          active: boolean
          created_at: string
          max_attempts: number
          tel_agent: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          max_attempts?: number
          tel_agent: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          max_attempts?: number
          tel_agent?: string
          updated_at?: string
        }
        Relationships: []
      }
      follow_up_cadence_intervals: {
        Row: {
          from_attempt: number
          tel_agent: string
          wait_interval: string
        }
        Insert: {
          from_attempt: number
          tel_agent: string
          wait_interval: string
        }
        Update: {
          from_attempt?: number
          tel_agent?: string
          wait_interval?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_cadence_intervals_tel_agent_fkey"
            columns: ["tel_agent"]
            isOneToOne: false
            referencedRelation: "follow_up_cadence_config"
            referencedColumns: ["tel_agent"]
          },
        ]
      }
      gatilhos: {
        Row: {
          acoes: Json | null
          condicoes: Json | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          proxima_execucao: string | null
          status: Database["public"]["Enums"]["status_gatilho"] | null
          tipo: Database["public"]["Enums"]["tipo_gatilho"] | null
          ultima_execucao: string | null
          updated_at: string | null
        }
        Insert: {
          acoes?: Json | null
          condicoes?: Json | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          proxima_execucao?: string | null
          status?: Database["public"]["Enums"]["status_gatilho"] | null
          tipo?: Database["public"]["Enums"]["tipo_gatilho"] | null
          ultima_execucao?: string | null
          updated_at?: string | null
        }
        Update: {
          acoes?: Json | null
          condicoes?: Json | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          proxima_execucao?: string | null
          status?: Database["public"]["Enums"]["status_gatilho"] | null
          tipo?: Database["public"]["Enums"]["tipo_gatilho"] | null
          ultima_execucao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gatilhos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gatilhos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gatilhos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      global_opt_outs: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          motivo: string | null
          telefone_normalizado: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          motivo?: string | null
          telefone_normalizado: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          motivo?: string | null
          telefone_normalizado?: string
        }
        Relationships: []
      }
      horarios_trabalho: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dia_semana: Database["public"]["Enums"]["dia_semana"]
          hora_fim: string
          hora_inicio: string
          id: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dia_semana: Database["public"]["Enums"]["dia_semana"]
          hora_fim: string
          hora_inicio: string
          id?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dia_semana?: Database["public"]["Enums"]["dia_semana"]
          hora_fim?: string
          hora_inicio?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horarios_trabalho_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_trabalho_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          already_linked: number | null
          base_id: string | null
          chain_count: number
          created_at: string
          current_offset: number | null
          empresa_id: string
          error_details: Json | null
          errors: number | null
          file_name: string
          file_path: string
          id: string
          inserted: number | null
          last_heartbeat_at: string | null
          linked: number | null
          locked_until: string | null
          message: string | null
          origem: string | null
          processed_rows: number | null
          prospeccao_id: string | null
          quarantined: number | null
          rejected_reasons: Json
          rejected_responsavel: number
          responsavel_applied: number
          responsavel_skipped: number
          status: string
          total_rows: number | null
          updated: number | null
          updated_at: string
          user_id: string
          warning_details: Json
          worker_id: string | null
        }
        Insert: {
          already_linked?: number | null
          base_id?: string | null
          chain_count?: number
          created_at?: string
          current_offset?: number | null
          empresa_id: string
          error_details?: Json | null
          errors?: number | null
          file_name: string
          file_path: string
          id?: string
          inserted?: number | null
          last_heartbeat_at?: string | null
          linked?: number | null
          locked_until?: string | null
          message?: string | null
          origem?: string | null
          processed_rows?: number | null
          prospeccao_id?: string | null
          quarantined?: number | null
          rejected_reasons?: Json
          rejected_responsavel?: number
          responsavel_applied?: number
          responsavel_skipped?: number
          status?: string
          total_rows?: number | null
          updated?: number | null
          updated_at?: string
          user_id: string
          warning_details?: Json
          worker_id?: string | null
        }
        Update: {
          already_linked?: number | null
          base_id?: string | null
          chain_count?: number
          created_at?: string
          current_offset?: number | null
          empresa_id?: string
          error_details?: Json | null
          errors?: number | null
          file_name?: string
          file_path?: string
          id?: string
          inserted?: number | null
          last_heartbeat_at?: string | null
          linked?: number | null
          locked_until?: string | null
          message?: string | null
          origem?: string | null
          processed_rows?: number | null
          prospeccao_id?: string | null
          quarantined?: number | null
          rejected_reasons?: Json
          rejected_responsavel?: number
          responsavel_applied?: number
          responsavel_skipped?: number
          status?: string
          total_rows?: number | null
          updated?: number | null
          updated_at?: string
          user_id?: string
          warning_details?: Json
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases_importadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_logs_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_cadeiras: {
        Row: {
          acao: string
          created_at: string
          email: string | null
          empresa_id: string | null
          executado_por: string | null
          id: string
          metadata: Json
          profile_id: string | null
          prospeccao_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          executado_por?: string | null
          id?: string
          metadata?: Json
          profile_id?: string | null
          prospeccao_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          executado_por?: string | null
          id?: string
          metadata?: Json
          profile_id?: string | null
          prospeccao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_cadeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_cadeiras_executado_por_fkey"
            columns: ["executado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_cadeiras_executado_por_fkey"
            columns: ["executado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_cadeiras_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_cadeiras_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_cadeiras_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_disparos: {
        Row: {
          batch_index: number | null
          canal: string
          cotacao_data: string | null
          cotacao_dolar: number | null
          created_at: string
          custo_total_brl: number | null
          custo_total_usd: number
          disparo_id: string
          empresa_id: string | null
          evento_nome: string | null
          id: string
          job_id: string | null
          marca: string | null
          origem: string
          prospeccao_id: string
          template_id: string | null
          template_nome: string | null
          tipo_evento: string | null
          total_contatos: number
          total_falha: number | null
          total_sucesso: number | null
          uf: string | null
          usuario_email: string | null
          usuario_id: string
          usuario_nome: string | null
          usuario_perfil: string | null
          valor_unitario_usd: number
        }
        Insert: {
          batch_index?: number | null
          canal: string
          cotacao_data?: string | null
          cotacao_dolar?: number | null
          created_at?: string
          custo_total_brl?: number | null
          custo_total_usd: number
          disparo_id?: string
          empresa_id?: string | null
          evento_nome?: string | null
          id?: string
          job_id?: string | null
          marca?: string | null
          origem?: string
          prospeccao_id: string
          template_id?: string | null
          template_nome?: string | null
          tipo_evento?: string | null
          total_contatos?: number
          total_falha?: number | null
          total_sucesso?: number | null
          uf?: string | null
          usuario_email?: string | null
          usuario_id: string
          usuario_nome?: string | null
          usuario_perfil?: string | null
          valor_unitario_usd?: number
        }
        Update: {
          batch_index?: number | null
          canal?: string
          cotacao_data?: string | null
          cotacao_dolar?: number | null
          created_at?: string
          custo_total_brl?: number | null
          custo_total_usd?: number
          disparo_id?: string
          empresa_id?: string | null
          evento_nome?: string | null
          id?: string
          job_id?: string | null
          marca?: string | null
          origem?: string
          prospeccao_id?: string
          template_id?: string | null
          template_nome?: string | null
          tipo_evento?: string | null
          total_contatos?: number
          total_falha?: number | null
          total_sucesso?: number | null
          uf?: string | null
          usuario_email?: string | null
          usuario_id?: string
          usuario_nome?: string | null
          usuario_perfil?: string | null
          valor_unitario_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "logs_disparos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_movimentacao_contatos: {
        Row: {
          contato_id: string
          created_at: string
          data_movimentacao: string
          id: string
          observacoes: string | null
          prospeccao_id: string
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          contato_id: string
          created_at?: string
          data_movimentacao?: string
          id?: string
          observacoes?: string | null
          prospeccao_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          contato_id?: string
          created_at?: string
          data_movimentacao?: string
          id?: string
          observacoes?: string | null
          prospeccao_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      logs_notificacoes_email: {
        Row: {
          assunto: string
          created_at: string
          destinatario_email: string
          destinatario_nome: string | null
          empresa_id: string | null
          enviado_por: string | null
          erro: string | null
          id: string
          referencia_id: string | null
          referencia_tipo: string | null
          status: string
          tipo: string
        }
        Insert: {
          assunto: string
          created_at?: string
          destinatario_email: string
          destinatario_nome?: string | null
          empresa_id?: string | null
          enviado_por?: string | null
          erro?: string | null
          id?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo?: string
        }
        Update: {
          assunto?: string
          created_at?: string
          destinatario_email?: string
          destinatario_nome?: string | null
          empresa_id?: string | null
          enviado_por?: string | null
          erro?: string | null
          id?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_notificacoes_email_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_prospeccoes: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          detalhes: string | null
          empresa_id: string
          id: string
          prospeccao_id: string
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          detalhes?: string | null
          empresa_id: string
          id?: string
          prospeccao_id: string
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          detalhes?: string | null
          empresa_id?: string
          id?: string
          prospeccao_id?: string
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      mensagens_padrao: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          mensagem: string | null
          periodo_dias: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          mensagem?: string | null
          periodo_dias?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          mensagem?: string | null
          periodo_dias?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_padrao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_account_access: {
        Row: {
          account_id: string
          active: boolean
          granted_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          active?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          active?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mfa_accounts: {
        Row: {
          algorithm: string
          created_at: string
          created_by: string | null
          digits: number
          id: string
          issuer: string
          label: string | null
          period: number
          secret_encrypted: string
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm?: string
          created_at?: string
          created_by?: string | null
          digits?: number
          id: string
          issuer: string
          label?: string | null
          period?: number
          secret_encrypted: string
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm?: string
          created_at?: string
          created_by?: string | null
          digits?: number
          id?: string
          issuer?: string
          label?: string | null
          period?: number
          secret_encrypted?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mfa_audit_logs: {
        Row: {
          account_id: string | null
          account_issuer: string | null
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_user_email: string | null
          target_user_id: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          account_id?: string | null
          account_issuer?: string | null
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_email?: string | null
          target_user_id?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          account_id?: string | null
          account_issuer?: string | null
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_email?: string | null
          target_user_id?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      mfa_feature_flags: {
        Row: {
          enabled: boolean
          flag_key: string
          flag_label: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          flag_key: string
          flag_label: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          flag_key?: string
          flag_label?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mfa_master_users: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      mfa_password_vault: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          id: string
          login: string
          notes: string | null
          password_encrypted: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          id?: string
          login: string
          notes?: string | null
          password_encrypted: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          id?: string
          login?: string
          notes?: string | null
          password_encrypted?: string
          updated_at?: string
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          account_id: string
          codes: string[]
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          codes?: string[]
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          codes?: string[]
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      motivos_insucesso: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motivos_insucesso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos_nao_participacao: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motivos_nao_participacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          cliente_id: string | null
          contato_id: string | null
          created_at: string | null
          data_envio: string | null
          data_leitura: string | null
          destinatario_id: string | null
          id: string
          mensagem: string
          remetente_id: string | null
          status: Database["public"]["Enums"]["status_notificacao"] | null
          tipo: Database["public"]["Enums"]["tipo_notificacao"] | null
          tipo_notificacao_id: string | null
          titulo: string
        }
        Insert: {
          cliente_id?: string | null
          contato_id?: string | null
          created_at?: string | null
          data_envio?: string | null
          data_leitura?: string | null
          destinatario_id?: string | null
          id?: string
          mensagem: string
          remetente_id?: string | null
          status?: Database["public"]["Enums"]["status_notificacao"] | null
          tipo?: Database["public"]["Enums"]["tipo_notificacao"] | null
          tipo_notificacao_id?: string | null
          titulo: string
        }
        Update: {
          cliente_id?: string | null
          contato_id?: string | null
          created_at?: string | null
          data_envio?: string | null
          data_leitura?: string | null
          destinatario_id?: string | null
          id?: string
          mensagem?: string
          remetente_id?: string | null
          status?: Database["public"]["Enums"]["status_notificacao"] | null
          tipo?: Database["public"]["Enums"]["tipo_notificacao"] | null
          tipo_notificacao_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_lead_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_tipo_notificacao_id_fkey"
            columns: ["tipo_notificacao_id"]
            isOneToOne: false
            referencedRelation: "tipos_notificacao"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_importacao: {
        Row: {
          base_nome: string
          created_at: string
          empresa_id: string
          id: string
          observacoes: string | null
          prospeccao_id: string | null
          revisado_at: string | null
          revisado_por: string | null
          solicitante_id: string
          solicitante_nome: string
          status: string
          total_contatos: number | null
          updated_at: string
        }
        Insert: {
          base_nome: string
          created_at?: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          prospeccao_id?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          solicitante_id: string
          solicitante_nome: string
          status?: string
          total_contatos?: number | null
          updated_at?: string
        }
        Update: {
          base_nome?: string
          created_at?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          prospeccao_id?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          solicitante_id?: string
          solicitante_nome?: string
          status?: string
          total_contatos?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_importacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_importacao_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      opt_outs: {
        Row: {
          canal: Database["public"]["Enums"]["canal_optout"]
          created_at: string
          created_by: string | null
          data_optout: string
          dedupe_key: string
          email_normalizado: string | null
          empresa_id: string
          id: string
          nome: string | null
          source: string
          telefone_e164: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          canal: Database["public"]["Enums"]["canal_optout"]
          created_at?: string
          created_by?: string | null
          data_optout: string
          dedupe_key: string
          email_normalizado?: string | null
          empresa_id: string
          id?: string
          nome?: string | null
          source?: string
          telefone_e164?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          canal?: Database["public"]["Enums"]["canal_optout"]
          created_at?: string
          created_by?: string | null
          data_optout?: string
          dedupe_key?: string
          email_normalizado?: string | null
          empresa_id?: string
          id?: string
          nome?: string | null
          source?: string
          telefone_e164?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opt_outs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      origens_lead: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "origens_lead_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      participacoes_treinamento: {
        Row: {
          certificado_url: string | null
          created_at: string | null
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          nota: number | null
          participante_id: string | null
          progresso: number | null
          treinamento_id: string | null
        }
        Insert: {
          certificado_url?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          nota?: number | null
          participante_id?: string | null
          progresso?: number | null
          treinamento_id?: string | null
        }
        Update: {
          certificado_url?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          nota?: number | null
          participante_id?: string | null
          progresso?: number | null
          treinamento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participacoes_treinamento_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participacoes_treinamento_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participacoes_treinamento_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          empresa_id: string | null
          exemplo_conversas: Json | null
          id: string
          instrucoes_sistema: string | null
          nome: string
          personalidade: string | null
          status: Database["public"]["Enums"]["status_persona"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string | null
          exemplo_conversas?: Json | null
          id?: string
          instrucoes_sistema?: string | null
          nome: string
          personalidade?: string | null
          status?: Database["public"]["Enums"]["status_persona"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string | null
          exemplo_conversas?: Json | null
          id?: string
          instrucoes_sistema?: string | null
          nome?: string
          personalidade?: string | null
          status?: Database["public"]["Enums"]["status_persona"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_clientes_externos: {
        Row: {
          canal: string | null
          cnpj_loja: string | null
          codigo_loja: string | null
          codigo_proposta: string
          created_at: string
          criado_em_origem: string | null
          email_cliente: string | null
          empresa_id: string | null
          id: string
          importado_em_evento_ids: string[] | null
          ingestao_job_id: string | null
          lead_maia: string | null
          lead_pri: string | null
          motivo_nao_venda: string | null
          motivo_orfao: string | null
          nome_cliente: string | null
          origem: string | null
          snapshot_date: string | null
          status: string
          status_crm: string | null
          tags: string[] | null
          telefone: string | null
          telefone_digits: string | null
          updated_at: string
          veiculo_interesse: string | null
        }
        Insert: {
          canal?: string | null
          cnpj_loja?: string | null
          codigo_loja?: string | null
          codigo_proposta: string
          created_at?: string
          criado_em_origem?: string | null
          email_cliente?: string | null
          empresa_id?: string | null
          id?: string
          importado_em_evento_ids?: string[] | null
          ingestao_job_id?: string | null
          lead_maia?: string | null
          lead_pri?: string | null
          motivo_nao_venda?: string | null
          motivo_orfao?: string | null
          nome_cliente?: string | null
          origem?: string | null
          snapshot_date?: string | null
          status?: string
          status_crm?: string | null
          tags?: string[] | null
          telefone?: string | null
          telefone_digits?: string | null
          updated_at?: string
          veiculo_interesse?: string | null
        }
        Update: {
          canal?: string | null
          cnpj_loja?: string | null
          codigo_loja?: string | null
          codigo_proposta?: string
          created_at?: string
          criado_em_origem?: string | null
          email_cliente?: string | null
          empresa_id?: string | null
          id?: string
          importado_em_evento_ids?: string[] | null
          ingestao_job_id?: string | null
          lead_maia?: string | null
          lead_pri?: string | null
          motivo_nao_venda?: string | null
          motivo_orfao?: string | null
          nome_cliente?: string | null
          origem?: string | null
          snapshot_date?: string | null
          status?: string
          status_crm?: string | null
          tags?: string[] | null
          telefone?: string | null
          telefone_digits?: string | null
          updated_at?: string
          veiculo_interesse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pool_clientes_externos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_clientes_externos_ingestao_job_id_fkey"
            columns: ["ingestao_job_id"]
            isOneToOne: false
            referencedRelation: "pool_ingestao_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_ingestao_jobs: {
        Row: {
          created_at: string
          erros: Json | null
          finished_at: string | null
          id: string
          payload_recebido: Json | null
          status: string
          total_orfaos: number | null
          total_processado: number | null
          total_recebido: number | null
        }
        Insert: {
          created_at?: string
          erros?: Json | null
          finished_at?: string | null
          id?: string
          payload_recebido?: Json | null
          status?: string
          total_orfaos?: number | null
          total_processado?: number | null
          total_recebido?: number | null
        }
        Update: {
          created_at?: string
          erros?: Json | null
          finished_at?: string | null
          id?: string
          payload_recebido?: Json | null
          status?: string
          total_orfaos?: number | null
          total_processado?: number | null
          total_recebido?: number | null
        }
        Relationships: []
      }
      pool_segmentacoes: {
        Row: {
          created_at: string
          criado_por: string
          empresa_id: string
          filtros: Json
          id: string
          marca: string
          nome: string
          prospeccao_id: string | null
          total_resultados: number
          uf: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          empresa_id: string
          filtros?: Json
          id?: string
          marca: string
          nome: string
          prospeccao_id?: string | null
          total_resultados?: number
          uf: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          empresa_id?: string
          filtros?: Json
          id?: string
          marca?: string
          nome?: string
          prospeccao_id?: string | null
          total_resultados?: number
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_segmentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_segmentacoes_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_vendas_cadencia_config: {
        Row: {
          agente_id: string
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          template_aniversario_id: string | null
          template_inicial_id: string | null
          template_previsao_id: string | null
          updated_at: string
        }
        Insert: {
          agente_id: string
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          template_aniversario_id?: string | null
          template_inicial_id?: string | null
          template_previsao_id?: string | null
          updated_at?: string
        }
        Update: {
          agente_id?: string
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          template_aniversario_id?: string | null
          template_inicial_id?: string | null
          template_previsao_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_vendas_cadencia_config_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_cadencia_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_cadencia_config_template_aniversario_id_fkey"
            columns: ["template_aniversario_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_cadencia_config_template_inicial_id_fkey"
            columns: ["template_inicial_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_cadencia_config_template_previsao_id_fkey"
            columns: ["template_previsao_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_vendas_followup: {
        Row: {
          ativo: boolean
          cadencia_id: string
          created_at: string
          id: string
          intervalo_horas: number
          ordem: number
          template_id: string | null
        }
        Insert: {
          ativo?: boolean
          cadencia_id: string
          created_at?: string
          id?: string
          intervalo_horas?: number
          ordem: number
          template_id?: string | null
        }
        Update: {
          ativo?: boolean
          cadencia_id?: string
          created_at?: string
          id?: string
          intervalo_horas?: number
          ordem?: number
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_vendas_followup_cadencia_id_fkey"
            columns: ["cadencia_id"]
            isOneToOne: false
            referencedRelation: "pos_vendas_cadencia_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_followup_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_vendas_gatilho_config: {
        Row: {
          agente_id: string
          ativo: boolean
          created_at: string
          empresa_id: string
          gatilho_slug: string
          id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          agente_id: string
          ativo?: boolean
          created_at?: string
          empresa_id: string
          gatilho_slug: string
          id?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          agente_id?: string
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          gatilho_slug?: string
          id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_vendas_gatilho_config_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_gatilho_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_gatilho_config_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_vendas_lojas: {
        Row: {
          agente_id: string
          ativo: boolean
          created_at: string
          dealer_id: string
          empresa_id: string
          id: string
          loja_nome: string | null
          marca: string
          movisis_id: string | null
          uf: string
          updated_at: string
        }
        Insert: {
          agente_id: string
          ativo?: boolean
          created_at?: string
          dealer_id: string
          empresa_id: string
          id?: string
          loja_nome?: string | null
          marca: string
          movisis_id?: string | null
          uf: string
          updated_at?: string
        }
        Update: {
          agente_id?: string
          ativo?: boolean
          created_at?: string
          dealer_id?: string
          empresa_id?: string
          id?: string
          loja_nome?: string | null
          marca?: string
          movisis_id?: string | null
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_vendas_lojas_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_lojas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          descricao: string | null
          empresa_id: string | null
          estoque: number | null
          ficha_tecnica: string | null
          foto_principal_index: number | null
          fotos: Json | null
          id: string
          imagem_url: string | null
          nome: string
          preco: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          estoque?: number | null
          ficha_tecnica?: string | null
          foto_principal_index?: number | null
          fotos?: Json | null
          id?: string
          imagem_url?: string | null
          nome: string
          preco?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          estoque?: number | null
          ficha_tecnica?: string | null
          foto_principal_index?: number | null
          fotos?: Json | null
          id?: string
          imagem_url?: string | null
          nome?: string
          preco?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          celular: string | null
          cpf: string | null
          created_at: string | null
          departamento: string | null
          empresa_id: string | null
          external_created_by: string | null
          foto_url: string | null
          gestor_imediato: string | null
          id: string
          is_active: boolean
          is_external: boolean
          nome_completo: string
          notificacao_email: boolean | null
          notificacao_whatsapp: boolean | null
          status: Database["public"]["Enums"]["status_usuario"] | null
          tipo_acesso: Database["public"]["Enums"]["tipo_acesso"] | null
          updated_at: string | null
        }
        Insert: {
          celular?: string | null
          cpf?: string | null
          created_at?: string | null
          departamento?: string | null
          empresa_id?: string | null
          external_created_by?: string | null
          foto_url?: string | null
          gestor_imediato?: string | null
          id: string
          is_active?: boolean
          is_external?: boolean
          nome_completo: string
          notificacao_email?: boolean | null
          notificacao_whatsapp?: boolean | null
          status?: Database["public"]["Enums"]["status_usuario"] | null
          tipo_acesso?: Database["public"]["Enums"]["tipo_acesso"] | null
          updated_at?: string | null
        }
        Update: {
          celular?: string | null
          cpf?: string | null
          created_at?: string | null
          departamento?: string | null
          empresa_id?: string | null
          external_created_by?: string | null
          foto_url?: string | null
          gestor_imediato?: string | null
          id?: string
          is_active?: boolean
          is_external?: boolean
          nome_completo?: string
          notificacao_email?: boolean | null
          notificacao_whatsapp?: boolean | null
          status?: Database["public"]["Enums"]["status_usuario"] | null
          tipo_acesso?: Database["public"]["Enums"]["tipo_acesso"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_external_created_by_fkey"
            columns: ["external_created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_external_created_by_fkey"
            columns: ["external_created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_gestor_imediato_fkey"
            columns: ["gestor_imediato"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_gestor_imediato_fkey"
            columns: ["gestor_imediato"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      proprietario_empresas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          proprietario_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          proprietario_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          proprietario_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proprietario_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proprietario_empresas_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proprietario_empresas_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_convites: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          imagem_url: string | null
          prospeccao_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          imagem_url?: string | null
          prospeccao_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          imagem_url?: string | null
          prospeccao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_convites_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: true
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_equipe_membros: {
        Row: {
          created_at: string
          equipe_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipe_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipe_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_equipe_membros_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_equipe_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_equipe_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_equipes: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
          prospeccao_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          prospeccao_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          prospeccao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_equipes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_equipes_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_marketing: {
        Row: {
          altura: number
          created_at: string
          empresa_id: string
          id: string
          imagem_url: string | null
          largura: number
          nome_arquivo: string | null
          plataforma: string
          prospeccao_id: string
          tamanho_arquivo: number | null
          tipo_formato: string
          updated_at: string
        }
        Insert: {
          altura: number
          created_at?: string
          empresa_id: string
          id?: string
          imagem_url?: string | null
          largura: number
          nome_arquivo?: string | null
          plataforma: string
          prospeccao_id: string
          tamanho_arquivo?: number | null
          tipo_formato: string
          updated_at?: string
        }
        Update: {
          altura?: number
          created_at?: string
          empresa_id?: string
          id?: string
          imagem_url?: string | null
          largura?: number
          nome_arquivo?: string | null
          plataforma?: string
          prospeccao_id?: string
          tamanho_arquivo?: number | null
          tipo_formato?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_marketing_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_marketing_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_metas_individuais: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          meta_checkins: number | null
          meta_confirmacoes: number | null
          meta_convites: number | null
          meta_vendas: number | null
          prospeccao_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          meta_checkins?: number | null
          meta_confirmacoes?: number | null
          meta_convites?: number | null
          meta_vendas?: number | null
          prospeccao_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          meta_checkins?: number | null
          meta_confirmacoes?: number | null
          meta_convites?: number | null
          meta_vendas?: number | null
          prospeccao_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_metas_individuais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_metas_individuais_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_metas_individuais_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_metas_individuais_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_outras_premiacoes: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          prospeccao_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          prospeccao_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          prospeccao_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_outras_premiacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_outras_premiacoes_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_paginas: {
        Row: {
          cor_destaque: string | null
          cor_fundo: string | null
          cor_texto: string | null
          created_at: string
          dia_final_evento: string | null
          empresa_id: string
          final_frase: string | null
          hora_inicio: string | null
          hora_termino: string | null
          id: string
          imagem_evento_url: string | null
          inicio_frase: string | null
          link_politica_privacidade: string | null
          palavra_destaque: string | null
          primeiro_dia_evento: string | null
          prospeccao_id: string
          texto_apoio: string | null
          updated_at: string
        }
        Insert: {
          cor_destaque?: string | null
          cor_fundo?: string | null
          cor_texto?: string | null
          created_at?: string
          dia_final_evento?: string | null
          empresa_id: string
          final_frase?: string | null
          hora_inicio?: string | null
          hora_termino?: string | null
          id?: string
          imagem_evento_url?: string | null
          inicio_frase?: string | null
          link_politica_privacidade?: string | null
          palavra_destaque?: string | null
          primeiro_dia_evento?: string | null
          prospeccao_id: string
          texto_apoio?: string | null
          updated_at?: string
        }
        Update: {
          cor_destaque?: string | null
          cor_fundo?: string | null
          cor_texto?: string | null
          created_at?: string
          dia_final_evento?: string | null
          empresa_id?: string
          final_frase?: string | null
          hora_inicio?: string | null
          hora_termino?: string | null
          id?: string
          imagem_evento_url?: string | null
          inicio_frase?: string | null
          link_politica_privacidade?: string | null
          palavra_destaque?: string | null
          primeiro_dia_evento?: string | null
          prospeccao_id?: string
          texto_apoio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_paginas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_paginas_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: true
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccoes: {
        Row: {
          ativo: boolean
          cadencia_completa: boolean
          canal: string
          canal_quarentena: string | null
          convite: string | null
          created_at: string | null
          data_envio_cadencia: string | null
          data_envio_template_inicial: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          disparos_pausados: boolean | null
          empresa_id: string
          encerrado_at: string | null
          event_id_pri: string | null
          evento_confirmacao: boolean
          evento_pai_id: string | null
          evento_principal: boolean
          id: string
          imagem_divulgacao_url: string | null
          is_teste: boolean
          leads_gerados: number | null
          meta_checkins: number | null
          meta_confirmacoes: number | null
          meta_convites: number | null
          meta_diretas: number | null
          meta_leads: number | null
          meta_novos: number | null
          meta_seminovos: number | null
          persona_id: string | null
          premio_checkin_bronze: number | null
          premio_checkin_ouro: number | null
          premio_checkin_prata: number | null
          premio_equipe_2lugar: number | null
          premio_equipe_3lugar: number | null
          premio_equipe_campea: number | null
          premio_indicacao_venda: number | null
          premio_participacao_apoio: number | null
          premio_prospector_bronze: number | null
          premio_prospector_ouro: number | null
          premio_prospector_prata: number | null
          premio_vendedor_bronze: number | null
          premio_vendedor_ouro: number | null
          premio_vendedor_prata: number | null
          qualificar_lead: boolean
          responsavel_id: string | null
          snapshot_realizado: boolean
          template_agendado_24h_id: string | null
          template_agendado_48h_id: string | null
          template_agendado_id: string | null
          template_nao_agendado_id: string | null
          template_prospeccao_id: string | null
          texto_convite_template: string | null
          tipo_lead: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          cadencia_completa?: boolean
          canal?: string
          canal_quarentena?: string | null
          convite?: string | null
          created_at?: string | null
          data_envio_cadencia?: string | null
          data_envio_template_inicial?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          disparos_pausados?: boolean | null
          empresa_id: string
          encerrado_at?: string | null
          event_id_pri?: string | null
          evento_confirmacao?: boolean
          evento_pai_id?: string | null
          evento_principal?: boolean
          id?: string
          imagem_divulgacao_url?: string | null
          is_teste?: boolean
          leads_gerados?: number | null
          meta_checkins?: number | null
          meta_confirmacoes?: number | null
          meta_convites?: number | null
          meta_diretas?: number | null
          meta_leads?: number | null
          meta_novos?: number | null
          meta_seminovos?: number | null
          persona_id?: string | null
          premio_checkin_bronze?: number | null
          premio_checkin_ouro?: number | null
          premio_checkin_prata?: number | null
          premio_equipe_2lugar?: number | null
          premio_equipe_3lugar?: number | null
          premio_equipe_campea?: number | null
          premio_indicacao_venda?: number | null
          premio_participacao_apoio?: number | null
          premio_prospector_bronze?: number | null
          premio_prospector_ouro?: number | null
          premio_prospector_prata?: number | null
          premio_vendedor_bronze?: number | null
          premio_vendedor_ouro?: number | null
          premio_vendedor_prata?: number | null
          qualificar_lead?: boolean
          responsavel_id?: string | null
          snapshot_realizado?: boolean
          template_agendado_24h_id?: string | null
          template_agendado_48h_id?: string | null
          template_agendado_id?: string | null
          template_nao_agendado_id?: string | null
          template_prospeccao_id?: string | null
          texto_convite_template?: string | null
          tipo_lead?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          cadencia_completa?: boolean
          canal?: string
          canal_quarentena?: string | null
          convite?: string | null
          created_at?: string | null
          data_envio_cadencia?: string | null
          data_envio_template_inicial?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          disparos_pausados?: boolean | null
          empresa_id?: string
          encerrado_at?: string | null
          event_id_pri?: string | null
          evento_confirmacao?: boolean
          evento_pai_id?: string | null
          evento_principal?: boolean
          id?: string
          imagem_divulgacao_url?: string | null
          is_teste?: boolean
          leads_gerados?: number | null
          meta_checkins?: number | null
          meta_confirmacoes?: number | null
          meta_convites?: number | null
          meta_diretas?: number | null
          meta_leads?: number | null
          meta_novos?: number | null
          meta_seminovos?: number | null
          persona_id?: string | null
          premio_checkin_bronze?: number | null
          premio_checkin_ouro?: number | null
          premio_checkin_prata?: number | null
          premio_equipe_2lugar?: number | null
          premio_equipe_3lugar?: number | null
          premio_equipe_campea?: number | null
          premio_indicacao_venda?: number | null
          premio_participacao_apoio?: number | null
          premio_prospector_bronze?: number | null
          premio_prospector_ouro?: number | null
          premio_prospector_prata?: number | null
          premio_vendedor_bronze?: number | null
          premio_vendedor_ouro?: number | null
          premio_vendedor_prata?: number | null
          qualificar_lead?: boolean
          responsavel_id?: string | null
          snapshot_realizado?: boolean
          template_agendado_24h_id?: string | null
          template_agendado_48h_id?: string | null
          template_agendado_id?: string | null
          template_nao_agendado_id?: string | null
          template_prospeccao_id?: string | null
          texto_convite_template?: string | null
          tipo_lead?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_evento_pai_id_fkey"
            columns: ["evento_pai_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_template_agendado_24h_id_fkey"
            columns: ["template_agendado_24h_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_template_agendado_48h_id_fkey"
            columns: ["template_agendado_48h_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_template_agendado_id_fkey"
            columns: ["template_agendado_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_template_nao_agendado_id_fkey"
            columns: ["template_nao_agendado_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccoes_template_prospeccao_id_fkey"
            columns: ["template_prospeccao_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_pri_voz: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          empresa_id: string | null
          enviado_whatsapp: boolean | null
          id: string
          id_evento: number
          lead_id: string | null
          ligacao_atendida: boolean | null
          ligacao_erro: boolean | null
          loja: string | null
          nome: string | null
          proposal_id: string | null
          status_agendado: boolean | null
          telefone_lead: string
          telefone_pri: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          empresa_id?: string | null
          enviado_whatsapp?: boolean | null
          id?: string
          id_evento: number
          lead_id?: string | null
          ligacao_atendida?: boolean | null
          ligacao_erro?: boolean | null
          loja?: string | null
          nome?: string | null
          proposal_id?: string | null
          status_agendado?: boolean | null
          telefone_lead: string
          telefone_pri?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          empresa_id?: string | null
          enviado_whatsapp?: boolean | null
          id?: string
          id_evento?: number
          lead_id?: string | null
          ligacao_atendida?: boolean | null
          ligacao_erro?: boolean | null
          loja?: string | null
          nome?: string | null
          proposal_id?: string | null
          status_agendado?: boolean | null
          telefone_lead?: string
          telefone_pri?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_pri_voz_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      quarentena_config: {
        Row: {
          canal: string
          dias: number
          empresa_id: string
          id: string
          marca: string
          updated_at: string
        }
        Insert: {
          canal: string
          dias?: number
          empresa_id: string
          id?: string
          marca: string
          updated_at?: string
        }
        Update: {
          canal?: string
          dias?: number
          empresa_id?: string
          id?: string
          marca?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarentena_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      quarentena_exclusoes: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          motivo: string | null
          telefone_normalizado: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          motivo?: string | null
          telefone_normalizado: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          motivo?: string | null
          telefone_normalizado?: string
        }
        Relationships: []
      }
      quarentena_logs: {
        Row: {
          acao: string
          created_at: string
          detalhes: string | null
          empresa_id: string | null
          id: string
          marca: string | null
          quarentena_id: string | null
          telefone_normalizado: string
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: string | null
          empresa_id?: string | null
          id?: string
          marca?: string | null
          quarentena_id?: string | null
          telefone_normalizado: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: string | null
          empresa_id?: string | null
          id?: string
          marca?: string | null
          quarentena_id?: string | null
          telefone_normalizado?: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quarentena_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarentena_logs_quarentena_id_fkey"
            columns: ["quarentena_id"]
            isOneToOne: false
            referencedRelation: "contato_quarentena"
            referencedColumns: ["id"]
          },
        ]
      }
      recepcao_visitas: {
        Row: {
          created_at: string
          data_hora_visita: string
          empresa_id: string
          id: string
          id_maia: string | null
          nome_campanha: string
          nome_cliente: string
          prospeccao_id: string | null
          telefone_cliente: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_hora_visita?: string
          empresa_id: string
          id?: string
          id_maia?: string | null
          nome_campanha: string
          nome_cliente: string
          prospeccao_id?: string | null
          telefone_cliente: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_hora_visita?: string
          empresa_id?: string
          id?: string
          id_maia?: string | null
          nome_campanha?: string
          nome_cliente?: string
          prospeccao_id?: string | null
          telefone_cliente?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recepcao_visitas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recepcao_visitas_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios: {
        Row: {
          created_at: string | null
          dados_relatorio: Json | null
          data_geracao: string | null
          descricao: string | null
          empresa_id: string | null
          gerado_por: string | null
          id: string
          nome: string
          parametros: Json | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          dados_relatorio?: Json | null
          data_geracao?: string | null
          descricao?: string | null
          empresa_id?: string | null
          gerado_por?: string | null
          id?: string
          nome: string
          parametros?: Json | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          dados_relatorio?: Json | null
          data_geracao?: string | null
          descricao?: string | null
          empresa_id?: string | null
          gerado_por?: string | null
          id?: string
          nome?: string
          parametros?: Json | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      system_feature_flags: {
        Row: {
          category: string
          created_at: string
          description: string | null
          flag_key: string
          flag_label: string
          id: string
          is_enabled: boolean
          scope: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          flag_key: string
          flag_label: string
          id?: string
          is_enabled?: boolean
          scope?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          flag_key?: string
          flag_label?: string
          id?: string
          is_enabled?: boolean
          scope?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      temperaturas_lead: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "temperaturas_lead_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      template_pausado_log: {
        Row: {
          created_at: string | null
          eventos_impactados: Json
          id: string
          id_meta_original: string
          pri_telefone: string | null
          status: string
          template_duplicado_id: string | null
          template_original_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          eventos_impactados?: Json
          id?: string
          id_meta_original: string
          pri_telefone?: string | null
          status?: string
          template_duplicado_id?: string | null
          template_original_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          eventos_impactados?: Json
          id?: string
          id_meta_original?: string
          pri_telefone?: string | null
          status?: string
          template_duplicado_id?: string | null
          template_original_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_pausado_log_template_duplicado_id_fkey"
            columns: ["template_duplicado_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_pausado_log_template_original_id_fkey"
            columns: ["template_original_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_notificacao: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          template_padrao: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          template_padrao?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          template_padrao?: string | null
        }
        Relationships: []
      }
      treinamento_modulos: {
        Row: {
          ativo: boolean
          cenario: string | null
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          persona_cargo: string | null
          persona_empresa: string | null
          persona_nome: string | null
          persona_objetivo: string | null
          prompt_ia: string | null
          titulo: string
          treinamento_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cenario?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          persona_cargo?: string | null
          persona_empresa?: string | null
          persona_nome?: string | null
          persona_objetivo?: string | null
          prompt_ia?: string | null
          titulo: string
          treinamento_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cenario?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          persona_cargo?: string | null
          persona_empresa?: string | null
          persona_nome?: string | null
          persona_objetivo?: string | null
          prompt_ia?: string | null
          titulo?: string
          treinamento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamento_modulos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_obrigatorios: {
        Row: {
          atribuido_por: string
          created_at: string
          empresa_id: string | null
          id: string
          motivo: string | null
          prazo: string | null
          treinamento_id: string
          user_id: string
        }
        Insert: {
          atribuido_por: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          prazo?: string | null
          treinamento_id: string
          user_id: string
        }
        Update: {
          atribuido_por?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          prazo?: string | null
          treinamento_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamento_obrigatorios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_obrigatorios_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_progresso: {
        Row: {
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          empresa_id: string | null
          feedback_ia: string | null
          id: string
          modulo_id: string | null
          nota: number | null
          status: string
          tempo_gasto_segundos: number | null
          tentativas: number | null
          treinamento_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          feedback_ia?: string | null
          id?: string
          modulo_id?: string | null
          nota?: number | null
          status?: string
          tempo_gasto_segundos?: number | null
          tentativas?: number | null
          treinamento_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          feedback_ia?: string | null
          id?: string
          modulo_id?: string | null
          nota?: number | null
          status?: string
          tempo_gasto_segundos?: number | null
          tentativas?: number | null
          treinamento_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamento_progresso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_progresso_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "treinamento_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_progresso_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          conteudo: string | null
          created_at: string | null
          criado_por: string | null
          departamento: string | null
          descricao: string | null
          dificuldade: string | null
          duracao_minutos: number | null
          empresa_id: string | null
          id: string
          instrutor_id: string | null
          nivel: string | null
          nota_minima: number | null
          tipo: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          conteudo?: string | null
          created_at?: string | null
          criado_por?: string | null
          departamento?: string | null
          descricao?: string | null
          dificuldade?: string | null
          duracao_minutos?: number | null
          empresa_id?: string | null
          id?: string
          instrutor_id?: string | null
          nivel?: string | null
          nota_minima?: number | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          conteudo?: string | null
          created_at?: string | null
          criado_por?: string | null
          departamento?: string | null
          descricao?: string | null
          dificuldade?: string | null
          duracao_minutos?: number | null
          empresa_id?: string | null
          id?: string
          instrutor_id?: string | null
          nivel?: string | null
          nota_minima?: number | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_instrutor_id_fkey"
            columns: ["instrutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_instrutor_id_fkey"
            columns: ["instrutor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_empresas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          is_ativa: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          is_ativa?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          is_ativa?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vapi_calls_cache: {
        Row: {
          agent_phone: string | null
          assistant_id: string | null
          call_id: string
          cost: number | null
          cost_llm: number | null
          cost_stt: number | null
          cost_transport: number | null
          cost_tts: number | null
          cost_vapi: number | null
          customer_number: string | null
          duration: number | null
          id: string
          phone_number_id: string | null
          raw_data: Json | null
          started_at: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          agent_phone?: string | null
          assistant_id?: string | null
          call_id: string
          cost?: number | null
          cost_llm?: number | null
          cost_stt?: number | null
          cost_transport?: number | null
          cost_tts?: number | null
          cost_vapi?: number | null
          customer_number?: string | null
          duration?: number | null
          id?: string
          phone_number_id?: string | null
          raw_data?: Json | null
          started_at?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          agent_phone?: string | null
          assistant_id?: string | null
          call_id?: string
          cost?: number | null
          cost_llm?: number | null
          cost_stt?: number | null
          cost_transport?: number | null
          cost_tts?: number | null
          cost_vapi?: number | null
          customer_number?: string | null
          duration?: number | null
          id?: string
          phone_number_id?: string | null
          raw_data?: Json | null
          started_at?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      vendas_prospeccao: {
        Row: {
          cliente_nome: string
          cliente_telefone: string | null
          comprovante_url: string | null
          contato_id: string
          created_at: string
          data_venda: string
          departamento_id: string | null
          empresa_id: string
          id: string
          numero_venda: number
          produto_id: string | null
          prospeccao_id: string
          responsavel_id: string | null
          updated_at: string
          valor_venda: number | null
        }
        Insert: {
          cliente_nome: string
          cliente_telefone?: string | null
          comprovante_url?: string | null
          contato_id: string
          created_at?: string
          data_venda?: string
          departamento_id?: string | null
          empresa_id: string
          id?: string
          numero_venda: number
          produto_id?: string | null
          prospeccao_id: string
          responsavel_id?: string | null
          updated_at?: string
          valor_venda?: number | null
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string | null
          comprovante_url?: string | null
          contato_id?: string
          created_at?: string
          data_venda?: string
          departamento_id?: string | null
          empresa_id?: string
          id?: string
          numero_venda?: number
          produto_id?: string | null
          prospeccao_id?: string
          responsavel_id?: string | null
          updated_at?: string
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_prospeccao_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_prospeccao_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_prospeccao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_prospeccao_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_prospeccao_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_prospeccao_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_prospeccao_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          agente_id: string | null
          ativo: boolean
          card_data: Json | null
          categoria: string
          category_meta: string | null
          conteudo: string | null
          created_at: string
          departamento_id: string | null
          empresa_id: string
          exemplos_variaveis: Json | null
          formato: string
          id: string
          id_meta: string | null
          nome: string
          pri_telefone: string | null
          status: string
          status_meta: string | null
          template_id_pri: string | null
          updated_at: string
          variable_mapping: Json | null
        }
        Insert: {
          agente_id?: string | null
          ativo?: boolean
          card_data?: Json | null
          categoria: string
          category_meta?: string | null
          conteudo?: string | null
          created_at?: string
          departamento_id?: string | null
          empresa_id: string
          exemplos_variaveis?: Json | null
          formato: string
          id?: string
          id_meta?: string | null
          nome: string
          pri_telefone?: string | null
          status?: string
          status_meta?: string | null
          template_id_pri?: string | null
          updated_at?: string
          variable_mapping?: Json | null
        }
        Update: {
          agente_id?: string | null
          ativo?: boolean
          card_data?: Json | null
          categoria?: string
          category_meta?: string | null
          conteudo?: string | null
          created_at?: string
          departamento_id?: string | null
          empresa_id?: string
          exemplos_variaveis?: Json | null
          formato?: string
          id?: string
          id_meta?: string | null
          nome?: string
          pri_telefone?: string | null
          status?: string
          status_meta?: string | null
          template_id_pri?: string | null
          updated_at?: string
          variable_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_vinculados: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          status: string
          telefone: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          status?: string
          telefone: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          status?: string
          telefone?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_vinculados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_vinculados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_vinculados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mfa_accounts_decrypted: {
        Row: {
          algorithm: string | null
          created_at: string | null
          created_by: string | null
          digits: number | null
          id: string | null
          issuer: string | null
          label: string | null
          period: number | null
          secret: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          algorithm?: string | null
          created_at?: string | null
          created_by?: string | null
          digits?: number | null
          id?: string | null
          issuer?: string | null
          label?: string | null
          period?: number | null
          secret?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          algorithm?: string | null
          created_at?: string | null
          created_by?: string | null
          digits?: number | null
          id?: string | null
          issuer?: string | null
          label?: string | null
          period?: number | null
          secret?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mfa_password_vault_decrypted: {
        Row: {
          account_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          login: string | null
          notes: string | null
          password_plain: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          login?: string | null
          notes?: string | null
          password_plain?: never
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          login?: string | null
          notes?: string | null
          password_plain?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          created_at: string | null
          departamento: string | null
          empresa_id: string | null
          foto_url: string | null
          id: string | null
          nome_completo: string | null
          status: Database["public"]["Enums"]["status_usuario"] | null
          tipo_acesso: Database["public"]["Enums"]["tipo_acesso"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          departamento?: string | null
          empresa_id?: string | null
          foto_url?: string | null
          id?: string | null
          nome_completo?: string | null
          status?: Database["public"]["Enums"]["status_usuario"] | null
          tipo_acesso?: Database["public"]["Enums"]["tipo_acesso"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          departamento?: string | null
          empresa_id?: string | null
          foto_url?: string | null
          id?: string | null
          nome_completo?: string | null
          status?: Database["public"]["Enums"]["status_usuario"] | null
          tipo_acesso?: Database["public"]["Enums"]["tipo_acesso"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      academy_recalcular_metricas_usuario: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      add_agente_ia: {
        Args: { p_agente: string; p_contato_id: string }
        Returns: boolean
      }
      auto_atribuir_leads_vendedor: {
        Args: { user_id_param?: string }
        Returns: number
      }
      auto_provision_user_from_sso: {
        Args: { p_user_id: string }
        Returns: Json
      }
      bulk_update_lead_ids: { Args: { p_items: Json }; Returns: number }
      bulk_update_telefones_contatos: {
        Args: { p_empresa_id: string; p_items: Json }
        Returns: number
      }
      bulk_upsert_contatos: {
        Args: {
          p_canal?: string
          p_contatos: Json
          p_empresa_id: string
          p_force_status_novo?: boolean
          p_prospeccao_id?: string
        }
        Returns: Json
      }
      bulk_upsert_contatos_backup_v1: {
        Args: {
          p_canal?: string
          p_contatos: Json
          p_empresa_id: string
          p_force_status_novo?: boolean
          p_prospeccao_id?: string
        }
        Returns: Json
      }
      can_manage_users: { Args: { user_id?: string }; Returns: boolean }
      can_user_login: {
        Args: { _method?: string; _user_id: string }
        Returns: boolean
      }
      check_contato_by_telefone: {
        Args: { p_empresa_id: string; p_telefone: string }
        Returns: Json
      }
      check_global_opt_out: { Args: { p_telefone: string }; Returns: boolean }
      check_global_opt_out_bulk: {
        Args: { p_telefones: string[] }
        Returns: {
          bloqueado: boolean
          telefone: string
        }[]
      }
      check_password_protection_status: { Args: never; Returns: string }
      check_quarentena: {
        Args: { p_canal?: string; p_loja_id: string; p_telefones: string[] }
        Returns: {
          data_fim_evento: string
          em_quarentena: boolean
          evento: string
          telefone: string
          ultimo_impacto: string
        }[]
      }
      check_user_email_exists: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      check_user_is_admin: {
        Args: { user_id_param?: string }
        Returns: boolean
      }
      claim_import_processing: {
        Args: {
          p_import_id: string
          p_max_chains?: number
          p_worker_id: string
        }
        Returns: {
          already_linked: number | null
          base_id: string | null
          chain_count: number
          created_at: string
          current_offset: number | null
          empresa_id: string
          error_details: Json | null
          errors: number | null
          file_name: string
          file_path: string
          id: string
          inserted: number | null
          last_heartbeat_at: string | null
          linked: number | null
          locked_until: string | null
          message: string | null
          origem: string | null
          processed_rows: number | null
          prospeccao_id: string | null
          quarantined: number | null
          rejected_reasons: Json
          rejected_responsavel: number
          responsavel_applied: number
          responsavel_skipped: number
          status: string
          total_rows: number | null
          updated: number | null
          updated_at: string
          user_id: string
          warning_details: Json
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "import_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      count_vendedor_leads_pendentes: {
        Args: { user_id_param: string }
        Returns: number
      }
      create_lead_atomic: {
        Args: {
          p_email?: string
          p_empresa_id: string
          p_nome: string
          p_observacoes?: string
          p_origem?: string
          p_prospeccao_id?: string
          p_responsavel_email?: string
          p_status?: string
          p_telefone: string
        }
        Returns: Json
      }
      decrypt_mfa_secret: {
        Args: { encrypted_secret: string }
        Returns: string
      }
      encerrar_eventos_finalizados:
        | { Args: never; Returns: undefined }
        | {
            Args: {
              p_evento_id?: string
              p_limit?: number
              p_skip_descarte?: boolean
            }
            Returns: {
              out_descarte_count: number
              out_evento_id: string
              out_snapshot_count: number
            }[]
          }
      encrypt_mfa_secret: { Args: { plain_secret: string }; Returns: string }
      export_evento_base: {
        Args: {
          p_cursor?: string
          p_disparo?: string
          p_empresa_id: string
          p_limit?: number
          p_prospeccao_id: string
          p_search?: string
          p_status?: string
        }
        Returns: {
          contato_id: string
          created_at: string
          data_disparo_ia: string
          email: string
          evento_id: string
          nome: string
          origem: string
          responsavel_email: string
          status: string
          telefone: string
          updated_at: string
          vendedor_nome: string
        }[]
      }
      generate_optout_dedupe_key: {
        Args: {
          canal_param?: Database["public"]["Enums"]["canal_optout"]
          email?: string
          telefone?: string
        }
        Returns: string
      }
      get_company_users_for_selection: {
        Args: { company_id?: string }
        Returns: {
          departamento: string
          id: string
          nome_completo: string
          status: Database["public"]["Enums"]["status_usuario"]
          tipo_acesso: Database["public"]["Enums"]["tipo_acesso"]
        }[]
      }
      get_contato_timeline: {
        Args: { p_contato_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          descricao: string
          id: string
          metadata: Json
          tipo: string
          usuario_nome: string
        }[]
      }
      get_contatos_by_telefones: {
        Args: { p_empresa_id: string; p_telefones: string[] }
        Returns: {
          id: string
          telefone: string
        }[]
      }
      get_contatos_metricas: { Args: { p_empresa_id: string }; Returns: Json }
      get_contatos_paginated: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_empresa_id: string
          p_limit?: number
          p_offset?: number
          p_prospeccao_ids?: string[]
          p_responsavel?: string
          p_search?: string
          p_sort_column?: string
          p_sort_direction?: string
          p_status?: string
        }
        Returns: Json
      }
      get_current_user_access_type: {
        Args: never
        Returns: Database["public"]["Enums"]["tipo_acesso"]
      }
      get_current_user_email: { Args: never; Returns: string }
      get_desempenho_vendedores: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_empresa_id: string
          p_prospeccao_ids: string[]
        }
        Returns: {
          agendados: number
          atribuidos: number
          checkins: number
          confirmados: number
          convidados: number
          descartes: number
          em_espera: number
          nome_completo: string
          tipo_acesso: string
          user_id: string
          vendas: number
        }[]
      }
      get_kanban_columns: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_empresa_id: string
          p_per_column?: number
          p_prospeccao_ids?: string[]
          p_responsavel?: string
          p_search?: string
        }
        Returns: Json
      }
      get_kanban_columns_limited: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_empresa_id: string
          p_per_column?: number
          p_prospeccao_ids?: string[]
          p_responsavel?: string
          p_search?: string
        }
        Returns: Json
      }
      get_leads_mesmo_evento: {
        Args: {
          p_empresa_id: string
          p_prospeccao_id: string
          p_telefones: string[]
        }
        Returns: {
          contato_id: string
          nome: string
          responsavel_email: string
          status_atual: string
          telefone: string
          vendedor_nome: string
        }[]
      }
      get_logs_disparos_filtros: {
        Args: never
        Returns: {
          eventos: string[]
          marcas: string[]
          ufs: string[]
          usuarios: string[]
        }[]
      }
      get_next_venda_numero: {
        Args: { p_prospeccao_id: string }
        Returns: number
      }
      get_owned_companies: {
        Args: { user_id?: string }
        Returns: {
          empresa_id: string
        }[]
      }
      get_pool_clientes_for_empresa: {
        Args: {
          p_cursor_data?: string
          p_cursor_id?: string
          p_empresa_id: string
          p_filtros?: Json
          p_limit?: number
          p_with_total?: boolean
        }
        Returns: Json
      }
      get_pool_facets_for_empresa: {
        Args: { p_empresa_id: string }
        Returns: Json
      }
      get_prospeccao_metricas: {
        Args: { p_empresa_id: string; p_prospeccao_id: string }
        Returns: {
          disparados: number
          pendentes: number
          total: number
          vendas: number
        }[]
      }
      get_prospeccao_status_options: {
        Args: { p_empresa_id: string; p_prospeccao_id: string }
        Returns: {
          status: string
        }[]
      }
      get_prospeccoes_usuario: {
        Args: { p_empresa_id: string; p_user_id: string }
        Returns: string[]
      }
      get_quarentena_dias: {
        Args: { p_canal: string; p_empresa_id: string; p_marca: string }
        Returns: number
      }
      get_quarentena_paginated: {
        Args: {
          p_canal?: string
          p_date_from?: string
          p_date_to?: string
          p_empresa_id?: string
          p_limit?: number
          p_lojas?: string[]
          p_marcas?: string[]
          p_offset?: number
          p_search?: string
          p_sort_column?: string
          p_sort_direction?: string
          p_status?: string
        }
        Returns: Json
      }
      get_ranking_vendedores: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_empresa_id: string
          p_prospeccao_ids: string[]
        }
        Returns: {
          checkins: number
          convidados: number
          nome_completo: string
          user_id: string
          vendas: number
        }[]
      }
      get_relatorio_convidados: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_empresa_id: string
          p_prospeccao_ids?: string[]
        }
        Returns: {
          contato_id: string
          convidado_por: string
          convidado_por_nome: string
          data_convite: string
          email: string
          eventos: string[]
          lead_id: number
          nome: string
          status_atual: string
          telefone: string
        }[]
      }
      get_resumo_stats: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_empresa_id: string
          p_prospeccao_ids: string[]
        }
        Returns: {
          count: number
          status: string
        }[]
      }
      get_seats_limit: { Args: { p_empresa_id: string }; Returns: number }
      get_user_accessible_clients: {
        Args: { user_id_param?: string }
        Returns: {
          cliente_id: string
        }[]
      }
      get_user_active_company: {
        Args: { user_id_param?: string }
        Returns: string
      }
      get_user_marcas: { Args: { p_user_id?: string }; Returns: string[] }
      get_user_pri_telefone: { Args: never; Returns: string }
      get_users_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_users_with_email: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
          p_tipo_acesso_filter?: string[]
        }
        Returns: {
          celular: string
          cpf: string
          created_at: string
          departamento: string
          email: string
          empresa_id: string
          id: string
          nome_completo: string
          status: string
          tipo_acesso: string
          total_count: number
        }[]
      }
      heartbeat_import_processing: {
        Args: { p_import_id: string; p_worker_id: string }
        Returns: boolean
      }
      importar_pool_para_evento: {
        Args: { p_empresa_id: string; p_itens: Json; p_prospeccao_id: string }
        Returns: Json
      }
      increment_tentativas_chamada: {
        Args: { p_contato_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_company_owner: {
        Args: { company_id: string; user_id?: string }
        Returns: boolean
      }
      is_feature_enabled: { Args: { p_flag_key: string }; Returns: boolean }
      is_feature_enabled_for_empresa: {
        Args: { p_empresa_id: string; p_flag_key: string }
        Returns: boolean
      }
      is_mfa_master: { Args: { check_user_id?: string }; Returns: boolean }
      list_seat_usage: {
        Args: never
        Returns: {
          empresa_id: string
          in_use: number
          max_seats: number
          nome_empresa: string
        }[]
      }
      mark_stale_imports_as_error: { Args: never; Returns: number }
      mask_sensitive_data: {
        Args: {
          data_type: string
          user_type: Database["public"]["Enums"]["tipo_acesso"]
          value: string
        }
        Returns: string
      }
      mutate_contato_status_atomic: {
        Args: {
          p_anterior: string
          p_contato: string
          p_novo: string
          p_obs: string
          p_prospeccao: string
          p_usuario: string
        }
        Returns: {
          contato_id: string
          log_inserted: boolean
          status_anterior: string
          status_novo: string
          updated_at: string
        }[]
      }
      normalize_phone_br: { Args: { phone: string }; Returns: string }
      normalize_phone_canonical: { Args: { p_raw: string }; Returns: string }
      normalize_phone_e164: { Args: { phone_input: string }; Returns: string }
      password_login_enabled: { Args: never; Returns: boolean }
      phone_match_variants: { Args: { phone: string }; Returns: string[] }
      preview_importacao_conflitos: {
        Args: {
          p_empresa_id: string
          p_prospeccao_id: string
          p_telefones: string[]
        }
        Returns: {
          contato_id: string
          eventos_ativos: Json
          nome: string
          status_atual: string
          telefone: string
        }[]
      }
      set_seat_limit: {
        Args: { p_empresa_id: string; p_max_seats: number }
        Returns: undefined
      }
      set_user_active_company: {
        Args: { new_empresa_id: string }
        Returns: undefined
      }
      sync_leads_confirmacao: {
        Args: { p_evento_confirmacao_id: string; p_filtro_status?: string[] }
        Returns: Json
      }
      upsert_external_optout_snapshot: {
        Args: {
          p_entries: Json
          p_fetch_duration_ms: number
          p_marca_api: string
          p_today_sp: string
          p_total_records: number
          p_uf: string
        }
        Returns: string
      }
      upsert_quarentena: {
        Args: {
          p_canal?: string
          p_data_fim_evento: string
          p_evento_nome: string
          p_loja_id: string
          p_prospeccao_id: string
          p_telefone: string
        }
        Returns: undefined
      }
      user_belongs_to_company: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_empresa:
        | { Args: { target_empresa_id: string }; Returns: boolean }
        | {
            Args: { target_empresa_id: string; user_id?: string }
            Returns: boolean
          }
      user_in_same_company: {
        Args: { target_empresa_id: string }
        Returns: boolean
      }
      validate_email_domain: { Args: { email_input: string }; Returns: boolean }
      vendedor_precisa_leads: {
        Args: { user_id_param?: string }
        Returns: boolean
      }
    }
    Enums: {
      canal_optout: "Whatsapp" | "Ligação" | "SMS" | "E-mail"
      dia_semana:
        | "Segunda"
        | "Terça"
        | "Quarta"
        | "Quinta"
        | "Sexta"
        | "Sábado"
        | "Domingo"
      origem_lead:
        | "Site"
        | "WhatsApp"
        | "Instagram"
        | "Facebook"
        | "Google"
        | "Indicação"
        | "Telefone"
        | "Email"
        | "Outros"
        | "ligacao"
        | "grande_evento"
        | "prospeccao_mensal"
      status_agente_empresa:
        | "ativo"
        | "inativo"
        | "em_desenvolvimento"
        | "em_rollout"
        | "pendente"
      status_gatilho: "Ativo" | "Inativo" | "Pausado"
      status_lead:
        | "Novo"
        | "Atribuído"
        | "Em Espera"
        | "Convidado"
        | "Confirmado"
        | "Check-in"
        | "Venda"
        | "Descartado"
        | "Opt Out"
      status_meta: "Ativa" | "Pausada" | "Concluída" | "Cancelada"
      status_notificacao: "Enviada" | "Lida" | "Pendente" | "Erro"
      status_persona: "Ativa" | "Inativa" | "Em Desenvolvimento"
      status_usuario: "Ativo" | "Inativo" | "Suspenso"
      tipo_acesso:
        | "SDR"
        | "Gerente de Leads"
        | "Vendedor"
        | "Gerente de Loja"
        | "Busca"
        | "Diretor"
        | "Outros"
        | "TI"
        | "Administrador"
        | "Proprietário"
        | "CRM"
        | "Recepcionista"
        | "Coordenadora de Leads"
        | "Master"
        | "Sistema"
      tipo_evento_prospeccao:
        | "Contato Inicial"
        | "Follow-up"
        | "Proposta Enviada"
        | "Reunião Agendada"
        | "Negociação"
        | "Fechamento"
        | "Anotação"
      tipo_gatilho:
        | "Temporal"
        | "Evento"
        | "Condicional"
        | "novo_contato_prospeccao"
      tipo_meta: "Vendas" | "Leads" | "Conversão" | "Atendimento"
      tipo_notificacao: "Sistema" | "WhatsApp" | "Email" | "SMS" | "Push"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      canal_optout: ["Whatsapp", "Ligação", "SMS", "E-mail"],
      dia_semana: [
        "Segunda",
        "Terça",
        "Quarta",
        "Quinta",
        "Sexta",
        "Sábado",
        "Domingo",
      ],
      origem_lead: [
        "Site",
        "WhatsApp",
        "Instagram",
        "Facebook",
        "Google",
        "Indicação",
        "Telefone",
        "Email",
        "Outros",
        "ligacao",
        "grande_evento",
        "prospeccao_mensal",
      ],
      status_agente_empresa: [
        "ativo",
        "inativo",
        "em_desenvolvimento",
        "em_rollout",
        "pendente",
      ],
      status_gatilho: ["Ativo", "Inativo", "Pausado"],
      status_lead: [
        "Novo",
        "Atribuído",
        "Em Espera",
        "Convidado",
        "Confirmado",
        "Check-in",
        "Venda",
        "Descartado",
        "Opt Out",
      ],
      status_meta: ["Ativa", "Pausada", "Concluída", "Cancelada"],
      status_notificacao: ["Enviada", "Lida", "Pendente", "Erro"],
      status_persona: ["Ativa", "Inativa", "Em Desenvolvimento"],
      status_usuario: ["Ativo", "Inativo", "Suspenso"],
      tipo_acesso: [
        "SDR",
        "Gerente de Leads",
        "Vendedor",
        "Gerente de Loja",
        "Busca",
        "Diretor",
        "Outros",
        "TI",
        "Administrador",
        "Proprietário",
        "CRM",
        "Recepcionista",
        "Coordenadora de Leads",
        "Master",
        "Sistema",
      ],
      tipo_evento_prospeccao: [
        "Contato Inicial",
        "Follow-up",
        "Proposta Enviada",
        "Reunião Agendada",
        "Negociação",
        "Fechamento",
        "Anotação",
      ],
      tipo_gatilho: [
        "Temporal",
        "Evento",
        "Condicional",
        "novo_contato_prospeccao",
      ],
      tipo_meta: ["Vendas", "Leads", "Conversão", "Atendimento"],
      tipo_notificacao: ["Sistema", "WhatsApp", "Email", "SMS", "Push"],
    },
  },
} as const
