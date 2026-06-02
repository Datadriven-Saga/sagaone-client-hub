-- Cache diário de Opt-Out Externo (dia-calendário America/Sao_Paulo)

-- 1) Tabela de snapshots (controle de validade) — um por (marca_api, uf)
CREATE TABLE public.external_optout_snapshots (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_api           text        NOT NULL,
  uf                  text        NOT NULL,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  fetched_at_date_sp  date        NOT NULL,
  valid_until_date_sp date        NOT NULL,
  total_records       int         NOT NULL DEFAULT 0,
  fetch_duration_ms   int,
  status              text        NOT NULL DEFAULT 'ready'
                      CHECK (status IN ('ready','failed')),
  UNIQUE (marca_api, uf)
);

GRANT SELECT ON public.external_optout_snapshots TO authenticated;
GRANT ALL    ON public.external_optout_snapshots TO service_role;

ALTER TABLE public.external_optout_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "optout_snapshots_admin_read"
  ON public.external_optout_snapshots
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- 2) Tabela de entries — substituídas integralmente a cada revalidação
CREATE TABLE public.external_optout_entries (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id                 uuid        NOT NULL REFERENCES public.external_optout_snapshots(id) ON DELETE CASCADE,
  marca_api                   text        NOT NULL,
  uf                          text        NOT NULL,

  phone_normalized            text,
  email_normalized            text,
  cpf_normalized              text,

  api_id                      text,
  data_inicio                 timestamptz,
  data_conclusao              timestamptz,
  email_solicitante           text,
  nome_abreviado_cliente      text,
  nome_completo_cliente       text,
  telefone_cliente            text,
  cpf_cliente                 text,
  email_cliente               text,
  canal_solicitado_do_cliente text,
  nome_solicitante            text,
  telefone_solicitante        text,
  cargo_solicitante           text,
  departamento_solicitante    text,
  marca                       text,
  uf_original                 text,
  call_optin                  boolean,
  email_optin                 boolean,
  sms_optin                   boolean,
  whatsapp_optin              boolean,
  pesquisa_optin              boolean
);

GRANT SELECT ON public.external_optout_entries TO authenticated;
GRANT ALL    ON public.external_optout_entries TO service_role;

ALTER TABLE public.external_optout_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "optout_entries_admin_read"
  ON public.external_optout_entries
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE INDEX idx_optout_entries_phone
  ON public.external_optout_entries (marca_api, uf, phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE INDEX idx_optout_entries_email
  ON public.external_optout_entries (marca_api, uf, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX idx_optout_entries_cpf
  ON public.external_optout_entries (marca_api, uf, cpf_normalized)
  WHERE cpf_normalized IS NOT NULL;

CREATE INDEX idx_optout_entries_snapshot
  ON public.external_optout_entries (snapshot_id);

-- 3) RPC atômica: upsert do snapshot + substituição das entries
CREATE OR REPLACE FUNCTION public.upsert_external_optout_snapshot(
  p_marca_api         text,
  p_uf                text,
  p_today_sp          date,
  p_fetch_duration_ms int,
  p_total_records     int,
  p_entries           jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id uuid;
BEGIN
  INSERT INTO public.external_optout_snapshots
    (marca_api, uf, fetched_at, fetched_at_date_sp, valid_until_date_sp,
     total_records, fetch_duration_ms, status)
  VALUES
    (p_marca_api, p_uf, now(), p_today_sp, p_today_sp,
     p_total_records, p_fetch_duration_ms, 'ready')
  ON CONFLICT (marca_api, uf) DO UPDATE SET
    fetched_at          = EXCLUDED.fetched_at,
    fetched_at_date_sp  = EXCLUDED.fetched_at_date_sp,
    valid_until_date_sp = EXCLUDED.valid_until_date_sp,
    total_records       = EXCLUDED.total_records,
    fetch_duration_ms   = EXCLUDED.fetch_duration_ms,
    status              = EXCLUDED.status
  RETURNING id INTO v_snapshot_id;

  DELETE FROM public.external_optout_entries WHERE snapshot_id = v_snapshot_id;

  INSERT INTO public.external_optout_entries (
    snapshot_id, marca_api, uf,
    phone_normalized, email_normalized, cpf_normalized,
    api_id, data_inicio, data_conclusao,
    email_solicitante, nome_abreviado_cliente, nome_completo_cliente,
    telefone_cliente, cpf_cliente, email_cliente,
    canal_solicitado_do_cliente, nome_solicitante, telefone_solicitante,
    cargo_solicitante, departamento_solicitante,
    marca, uf_original,
    call_optin, email_optin, sms_optin, whatsapp_optin, pesquisa_optin
  )
  SELECT
    v_snapshot_id, p_marca_api, p_uf,
    NULLIF(e->>'phone_normalized',''),
    NULLIF(e->>'email_normalized',''),
    NULLIF(e->>'cpf_normalized',''),
    NULLIF(e->>'api_id',''),
    NULLIF(e->>'data_inicio','')::timestamptz,
    NULLIF(e->>'data_conclusao','')::timestamptz,
    NULLIF(e->>'email_solicitante',''),
    NULLIF(e->>'nome_abreviado_cliente',''),
    NULLIF(e->>'nome_completo_cliente',''),
    NULLIF(e->>'telefone_cliente',''),
    NULLIF(e->>'cpf_cliente',''),
    NULLIF(e->>'email_cliente',''),
    NULLIF(e->>'canal_solicitado_do_cliente',''),
    NULLIF(e->>'nome_solicitante',''),
    NULLIF(e->>'telefone_solicitante',''),
    NULLIF(e->>'cargo_solicitante',''),
    NULLIF(e->>'departamento_solicitante',''),
    NULLIF(e->>'marca',''),
    NULLIF(e->>'uf_original',''),
    NULLIF(e->>'call_optin','')::boolean,
    NULLIF(e->>'email_optin','')::boolean,
    NULLIF(e->>'sms_optin','')::boolean,
    NULLIF(e->>'whatsapp_optin','')::boolean,
    NULLIF(e->>'pesquisa_optin','')::boolean
  FROM jsonb_array_elements(p_entries) AS e;

  RETURN v_snapshot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_external_optout_snapshot(text,text,date,int,int,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_external_optout_snapshot(text,text,date,int,int,jsonb) TO service_role;