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
      contatos: {
        Row: {
          base_id: string | null
          cliente_id: string | null
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
          updated_at: string | null
          valor_potencial: number | null
          vendedor_nome: string | null
        }
        Insert: {
          base_id?: string | null
          cliente_id?: string | null
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
          updated_at?: string | null
          valor_potencial?: number | null
          vendedor_nome?: string | null
        }
        Update: {
          base_id?: string | null
          cliente_id?: string | null
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
          updated_at?: string | null
          valor_potencial?: number | null
          vendedor_nome?: string | null
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
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          departamento: string
          id?: string
          permissao: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          departamento?: string
          id?: string
          permissao?: string
          updated_at?: string
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
          tipo_evento:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
        }
        Insert: {
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
          tipo_evento?:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
        }
        Update: {
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
          tipo_evento?:
            | Database["public"]["Enums"]["tipo_evento_prospeccao"]
            | null
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
          secret: string
          updated_at: string
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
          secret: string
          updated_at?: string
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
          secret?: string
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
          foto_url: string | null
          gestor_imediato: string | null
          id: string
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
          foto_url?: string | null
          gestor_imediato?: string | null
          id: string
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
          foto_url?: string | null
          gestor_imediato?: string | null
          id?: string
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
          canal: string
          convite: string | null
          created_at: string | null
          data_envio_cadencia: string | null
          data_envio_template_inicial: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string
          event_id_pri: string | null
          evento_principal: boolean
          id: string
          imagem_divulgacao_url: string | null
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
          template_agendado_id: string | null
          template_nao_agendado_id: string | null
          template_prospeccao_id: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          canal?: string
          convite?: string | null
          created_at?: string | null
          data_envio_cadencia?: string | null
          data_envio_template_inicial?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id: string
          event_id_pri?: string | null
          evento_principal?: boolean
          id?: string
          imagem_divulgacao_url?: string | null
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
          template_agendado_id?: string | null
          template_nao_agendado_id?: string | null
          template_prospeccao_id?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          canal?: string
          convite?: string | null
          created_at?: string | null
          data_envio_cadencia?: string | null
          data_envio_template_inicial?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string
          event_id_pri?: string | null
          evento_principal?: boolean
          id?: string
          imagem_divulgacao_url?: string | null
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
          template_agendado_id?: string | null
          template_nao_agendado_id?: string | null
          template_prospeccao_id?: string | null
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
      auto_atribuir_leads_vendedor: {
        Args: { user_id_param?: string }
        Returns: number
      }
      can_manage_users: { Args: { user_id?: string }; Returns: boolean }
      check_password_protection_status: { Args: never; Returns: string }
      check_user_email_exists: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      check_user_is_admin: {
        Args: { user_id_param?: string }
        Returns: boolean
      }
      count_vendedor_leads_pendentes: {
        Args: { user_id_param?: string }
        Returns: number
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
      get_current_user_access_type: {
        Args: never
        Returns: Database["public"]["Enums"]["tipo_acesso"]
      }
      get_current_user_email: { Args: never; Returns: string }
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
      get_user_pri_telefone: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_company_owner: {
        Args: { company_id: string; user_id?: string }
        Returns: boolean
      }
      mask_sensitive_data: {
        Args: {
          data_type: string
          user_type: Database["public"]["Enums"]["tipo_acesso"]
          value: string
        }
        Returns: string
      }
      normalize_phone_e164: { Args: { phone_input: string }; Returns: string }
      set_user_active_company: {
        Args: { new_empresa_id: string }
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
        | "Em Contato"
        | "Qualificado"
        | "Proposta"
        | "Negociação"
        | "Fechado"
        | "Perdido"
        | "Atribuído"
        | "Convidado"
        | "Agendado"
        | "Confirmado"
        | "Check-in"
        | "Venda"
        | "Descartado"
        | "Desperdício"
        | "Em Espera"
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
        "Em Contato",
        "Qualificado",
        "Proposta",
        "Negociação",
        "Fechado",
        "Perdido",
        "Atribuído",
        "Convidado",
        "Agendado",
        "Confirmado",
        "Check-in",
        "Venda",
        "Descartado",
        "Desperdício",
        "Em Espera",
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
