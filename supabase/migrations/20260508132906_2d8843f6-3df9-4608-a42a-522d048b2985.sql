
-- Tabelas de cadência conversacional (compartilhada entre Entregas e Agendamentos)
CREATE TABLE public.follow_up_cadence_config (
  tel_agent text PRIMARY KEY,
  max_attempts int NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.follow_up_cadence_intervals (
  tel_agent text NOT NULL REFERENCES public.follow_up_cadence_config(tel_agent) ON DELETE CASCADE,
  from_attempt int NOT NULL CHECK (from_attempt >= 0),
  wait_interval interval NOT NULL,
  PRIMARY KEY (tel_agent, from_attempt)
);

ALTER TABLE public.follow_up_cadence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_cadence_intervals ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
CREATE POLICY fucc_select ON public.follow_up_cadence_config FOR SELECT TO authenticated USING (true);
CREATE POLICY fuci_select ON public.follow_up_cadence_intervals FOR SELECT TO authenticated USING (true);

-- Escrita: apenas Administrador / Master
CREATE POLICY fucc_insert ON public.follow_up_cadence_config FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY fucc_update ON public.follow_up_cadence_config FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY fucc_delete ON public.follow_up_cadence_config FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY fuci_insert ON public.follow_up_cadence_intervals FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY fuci_update ON public.follow_up_cadence_intervals FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY fuci_delete ON public.follow_up_cadence_intervals FOR DELETE TO authenticated USING (public.is_admin());

-- Trigger updated_at
CREATE TRIGGER trg_fucc_updated_at
BEFORE UPDATE ON public.follow_up_cadence_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Linha DEFAULT (fallback)
INSERT INTO public.follow_up_cadence_config (tel_agent, max_attempts, active) VALUES ('DEFAULT', 3, true);
INSERT INTO public.follow_up_cadence_intervals (tel_agent, from_attempt, wait_interval) VALUES
  ('DEFAULT', 0, interval '4 hours'),
  ('DEFAULT', 1, interval '6 hours'),
  ('DEFAULT', 2, interval '12 hours');

-- Remove colunas antigas (não usadas, sem dados)
ALTER TABLE public.pos_vendas_cadencia_config
  DROP COLUMN IF EXISTS max_tentativas,
  DROP COLUMN IF EXISTS intervalo_tentativas_horas;
