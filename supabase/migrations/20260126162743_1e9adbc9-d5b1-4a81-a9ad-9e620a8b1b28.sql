-- Tabela para armazenar dados de agentes Nextip (importados via Excel)
CREATE TABLE public.agentes_nextip (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_id text NOT NULL,
  nome text NOT NULL,
  agente text NOT NULL,
  marca text NOT NULL,
  uf text NOT NULL,
  loja text NOT NULL,
  numero text,
  status_meta text,
  bu text,
  id_numero text,
  waba text,
  id_aplicativo text,
  instancia text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(codigo_id)
);

-- Enable RLS
ALTER TABLE public.agentes_nextip ENABLE ROW LEVEL SECURITY;

-- Admin/TI full access policy
CREATE POLICY "agentes_nextip_admins_ti_full_access"
ON public.agentes_nextip
FOR ALL
TO authenticated
USING (
  get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
)
WITH CHECK (
  get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
);

-- Read-only for other users
CREATE POLICY "agentes_nextip_users_select"
ON public.agentes_nextip
FOR SELECT
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_agentes_nextip_updated_at
BEFORE UPDATE ON public.agentes_nextip
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common filters
CREATE INDEX idx_agentes_nextip_loja ON public.agentes_nextip(loja);
CREATE INDEX idx_agentes_nextip_marca ON public.agentes_nextip(marca);
CREATE INDEX idx_agentes_nextip_uf ON public.agentes_nextip(uf);
CREATE INDEX idx_agentes_nextip_agente ON public.agentes_nextip(agente);