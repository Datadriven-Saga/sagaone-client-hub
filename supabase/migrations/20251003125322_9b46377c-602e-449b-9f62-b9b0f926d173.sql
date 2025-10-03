-- Criar tabela para armazenar cadências dos agentes
CREATE TABLE IF NOT EXISTS public.agente_cadencias_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id uuid NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  nome_cadencia text NOT NULL,
  descricao text,
  tipo_disparo text NOT NULL CHECK (tipo_disparo IN ('whatsapp', 'ligacao')),
  tipo_mensagem text NOT NULL CHECK (tipo_mensagem IN ('dinamica', 'pre-definida')),
  mensagem_enviada text,
  intervalo_minutos integer NOT NULL DEFAULT 60,
  ativa boolean NOT NULL DEFAULT true,
  empresa_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agente_id, ordem)
);

-- Habilitar RLS
ALTER TABLE public.agente_cadencias_steps ENABLE ROW LEVEL SECURITY;

-- Política de acesso apenas para admins e TI
CREATE POLICY "agente_cadencias_steps_admins_ti_only"
ON public.agente_cadencias_steps
FOR ALL
USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  AND empresa_id = get_user_active_company(auth.uid())
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  AND empresa_id = get_user_active_company(auth.uid())
);

-- Trigger para updated_at
CREATE TRIGGER update_agente_cadencias_steps_updated_at
  BEFORE UPDATE ON public.agente_cadencias_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir as 11 cadências iniciais para o agente Maia
INSERT INTO public.agente_cadencias_steps (agente_id, ordem, nome_cadencia, tipo_disparo, tipo_mensagem, mensagem_enviada, intervalo_minutos, ativa, empresa_id)
SELECT 
  a.id,
  s.ordem,
  s.nome_cadencia,
  s.tipo_disparo,
  s.tipo_mensagem,
  s.mensagem_enviada,
  s.intervalo_minutos,
  s.ativa,
  a.empresa_id
FROM public.agentes_ia a
CROSS JOIN (
  VALUES
    (1, 'Cadência 1', 'whatsapp', 'dinamica', '', 60, true),
    (2, 'Cadência 2', 'whatsapp', 'dinamica', '', 60, true),
    (3, 'Cadência 3', 'whatsapp', 'dinamica', '', 60, true),
    (4, 'Cadência 4', 'whatsapp', 'dinamica', '', 60, true),
    (5, 'Cadência 5', 'whatsapp', 'pre-definida', 'Oi [nome_cliente]! Podemos retomar nossa conversa?', 1440, false),
    (6, 'Cadência 6', 'whatsapp', 'dinamica', '', 1440, false),
    (7, 'Cadência 7', 'whatsapp', 'dinamica', '', 1440, false),
    (8, 'Cadência 8', 'whatsapp', 'dinamica', '', 1440, false),
    (9, 'Cadência 9', 'whatsapp', 'dinamica', '', 1440, false),
    (10, 'Cadência 10', 'ligacao', 'dinamica', '', 1440, false),
    (11, 'Cadência 11', 'whatsapp', 'dinamica', '', 1440, false)
) AS s(ordem, nome_cadencia, tipo_disparo, tipo_mensagem, mensagem_enviada, intervalo_minutos, ativa)
WHERE a.nome = 'Maia'
ON CONFLICT (agente_id, ordem) DO NOTHING;