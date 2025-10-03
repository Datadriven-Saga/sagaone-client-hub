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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
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
        ]
      }
      contatos: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          email: string | null
          empresa_id: string
          id: string
          nome: string
          observacoes: string | null
          origem: Database["public"]["Enums"]["origem_lead"] | null
          responsavel_email: string | null
          status: Database["public"]["Enums"]["status_lead"] | null
          telefone: string | null
          updated_at: string | null
          valor_potencial: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          nome: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"] | null
          responsavel_email?: string | null
          status?: Database["public"]["Enums"]["status_lead"] | null
          telefone?: string | null
          updated_at?: string | null
          valor_potencial?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"] | null
          responsavel_email?: string | null
          status?: Database["public"]["Enums"]["status_lead"] | null
          telefone?: string | null
          updated_at?: string | null
          valor_potencial?: number | null
        }
        Relationships: [
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
          cnpj: string
          created_at: string | null
          crm_id: string | null
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
          cnpj: string
          created_at?: string | null
          crm_id?: string | null
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
          cnpj?: string
          created_at?: string | null
          crm_id?: string | null
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
      eventos_prospeccao: {
        Row: {
          contato_id: string | null
          created_at: string | null
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
        ]
      }
      prospeccoes: {
        Row: {
          canal: string
          condicoes_especiais: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string
          id: string
          imagem_divulgacao_url: string | null
          leads_gerados: number | null
          local_evento: string | null
          meta_leads: number | null
          objetivo_vendas: string | null
          persona_id: string | null
          responsavel_id: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          canal?: string
          condicoes_especiais?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          imagem_divulgacao_url?: string | null
          leads_gerados?: number | null
          local_evento?: string | null
          meta_leads?: number | null
          objetivo_vendas?: string | null
          persona_id?: string | null
          responsavel_id?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          canal?: string
          condicoes_especiais?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          imagem_divulgacao_url?: string | null
          leads_gerados?: number | null
          local_evento?: string | null
          meta_leads?: number | null
          objetivo_vendas?: string | null
          persona_id?: string | null
          responsavel_id?: string | null
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
      treinamentos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          conteudo: string | null
          created_at: string | null
          descricao: string | null
          duracao_minutos: number | null
          empresa_id: string | null
          id: string
          instrutor_id: string | null
          nivel: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          conteudo?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          empresa_id?: string | null
          id?: string
          instrutor_id?: string | null
          nivel?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          conteudo?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          empresa_id?: string | null
          id?: string
          instrutor_id?: string | null
          nivel?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_users: {
        Args: { user_id?: string }
        Returns: boolean
      }
      check_password_protection_status: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      check_user_email_exists: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      check_user_is_admin: {
        Args: { user_id_param?: string }
        Returns: boolean
      }
      generate_optout_dedupe_key: {
        Args: {
          canal_param?: Database["public"]["Enums"]["canal_optout"]
          email?: string
          telefone?: string
        }
        Returns: string
      }
      get_current_user_access_type: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["tipo_acesso"]
      }
      get_current_user_email: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_owned_companies: {
        Args: { user_id?: string }
        Returns: {
          empresa_id: string
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
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
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
      normalize_phone_e164: {
        Args: { phone_input: string }
        Returns: string
      }
      set_user_active_company: {
        Args: { new_empresa_id: string }
        Returns: undefined
      }
      user_in_same_company: {
        Args: { target_empresa_id: string }
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
      status_gatilho: "Ativo" | "Inativo" | "Pausado"
      status_lead:
        | "Novo"
        | "Em Contato"
        | "Qualificado"
        | "Proposta"
        | "Negociação"
        | "Fechado"
        | "Perdido"
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
      tipo_evento_prospeccao:
        | "Contato Inicial"
        | "Follow-up"
        | "Proposta Enviada"
        | "Reunião Agendada"
        | "Negociação"
        | "Fechamento"
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
      ],
      tipo_evento_prospeccao: [
        "Contato Inicial",
        "Follow-up",
        "Proposta Enviada",
        "Reunião Agendada",
        "Negociação",
        "Fechamento",
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
