ALTER TABLE public.prospeccoes ADD COLUMN IF NOT EXISTS evento_confirmacao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prospeccoes.evento_confirmacao IS 'Quando true, o evento é exclusivamente para confirmar presença de leads já agendados (status Convidado). Aplicável apenas a eventos do tipo IA WhatsApp.';