-- Allow 'limit_change' action
ALTER TABLE public.logs_cadeiras DROP CONSTRAINT IF EXISTS logs_cadeiras_acao_check;
ALTER TABLE public.logs_cadeiras ADD CONSTRAINT logs_cadeiras_acao_check
  CHECK (acao = ANY (ARRAY['create','renew','activate','deactivate','limit_change']));

-- FKs so PostgREST embeds work
ALTER TABLE public.logs_cadeiras
  ADD CONSTRAINT logs_cadeiras_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD CONSTRAINT logs_cadeiras_prospeccao_id_fkey
    FOREIGN KEY (prospeccao_id) REFERENCES public.prospeccoes(id) ON DELETE SET NULL,
  ADD CONSTRAINT logs_cadeiras_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT logs_cadeiras_executado_por_fkey
    FOREIGN KEY (executado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_logs_cadeiras_created_at ON public.logs_cadeiras (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_cadeiras_empresa ON public.logs_cadeiras (empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_cadeiras_acao ON public.logs_cadeiras (acao);