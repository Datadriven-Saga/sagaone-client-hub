CREATE TABLE public.vapi_calls_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL UNIQUE,
  assistant_id text,
  phone_number_id text,
  customer_number text,
  agent_phone text,
  duration integer DEFAULT 0,
  cost numeric(12,6) DEFAULT 0,
  status text,
  started_at timestamptz,
  cost_stt numeric(12,6) DEFAULT 0,
  cost_llm numeric(12,6) DEFAULT 0,
  cost_tts numeric(12,6) DEFAULT 0,
  cost_transport numeric(12,6) DEFAULT 0,
  cost_vapi numeric(12,6) DEFAULT 0,
  raw_data jsonb,
  synced_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vapi_calls_cache_started_at ON public.vapi_calls_cache (started_at);
CREATE INDEX idx_vapi_calls_cache_assistant_id ON public.vapi_calls_cache (assistant_id);
CREATE INDEX idx_vapi_calls_cache_phone_number_id ON public.vapi_calls_cache (phone_number_id);

ALTER TABLE public.vapi_calls_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read vapi cache"
  ON public.vapi_calls_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND tipo_acesso IN ('Administrador', 'TI', 'Master')
    )
  );