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
      empresas: {
        Row: {
          cnpj: string
          created_at: string | null
          email: string | null
          endereco: string | null
          grupo_empresarial: string | null
          horario_funcionamento: string | null
          id: string
          logomarca_url: string | null
          nome_empresa: string
          razao_social: string
          responsavel_legal_cpf: string | null
          responsavel_legal_email: string | null
          responsavel_legal_nome: string | null
          responsavel_legal_telefone: string | null
          site: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          grupo_empresarial?: string | null
          horario_funcionamento?: string | null
          id?: string
          logomarca_url?: string | null
          nome_empresa: string
          razao_social: string
          responsavel_legal_cpf?: string | null
          responsavel_legal_email?: string | null
          responsavel_legal_nome?: string | null
          responsavel_legal_telefone?: string | null
          site?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          grupo_empresarial?: string | null
          horario_funcionamento?: string | null
          id?: string
          logomarca_url?: string | null
          nome_empresa?: string
          razao_social?: string
          responsavel_legal_cpf?: string | null
          responsavel_legal_email?: string | null
          responsavel_legal_nome?: string | null
          responsavel_legal_telefone?: string | null
          site?: string | null
          updated_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      dia_semana:
        | "Segunda"
        | "Terça"
        | "Quarta"
        | "Quinta"
        | "Sexta"
        | "Sábado"
        | "Domingo"
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
      dia_semana: [
        "Segunda",
        "Terça",
        "Quarta",
        "Quinta",
        "Sexta",
        "Sábado",
        "Domingo",
      ],
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
      ],
    },
  },
} as const
