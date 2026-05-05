
-- P1: Coluna gerada com apenas dígitos do telefone
ALTER TABLE public.pool_clientes_externos
  ADD COLUMN IF NOT EXISTS telefone_digits TEXT
  GENERATED ALWAYS AS (regexp_replace(COALESCE(telefone,''), '[^0-9]', '', 'g')) STORED;

-- P0: índice composto para listagem comum (empresa + data desc, ativos com telefone)
CREATE INDEX IF NOT EXISTS idx_pool_ext_empresa_data_ativo
  ON public.pool_clientes_externos (empresa_id, criado_em_origem DESC)
  WHERE COALESCE(status,'ativo') = 'ativo'
    AND telefone IS NOT NULL AND telefone <> '';

-- P1: índice para filtro por DDD (2 primeiros dígitos)
CREATE INDEX IF NOT EXISTS idx_pool_ext_ddd
  ON public.pool_clientes_externos ((LEFT(telefone_digits, 2)))
  WHERE telefone_digits IS NOT NULL AND telefone_digits <> '';

-- ===== RPC: get_pool_clientes_for_empresa (otimizada) =====
CREATE OR REPLACE FUNCTION public.get_pool_clientes_for_empresa(
  p_empresa_id uuid,
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid, empresa_id uuid, codigo_proposta text, telefone text, nome_cliente text,
  email_cliente text, origem text, canal text, veiculo_interesse text,
  motivo_nao_venda text, status_crm text, lead_maia text, lead_pri text,
  criado_em_origem timestamp with time zone, codigo_loja text, cnpj_loja text, loja_nome text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_marca TEXT;
  v_uf TEXT;
  v_empresa_ids uuid[];
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT e.marca, e.uf INTO v_marca, v_uf FROM public.empresas e WHERE e.id = p_empresa_id;
  IF v_marca IS NULL OR v_uf IS NULL THEN RETURN; END IF;

  -- Resolve empresa_ids da mesma marca/UF (usa filtro de lojas se vier)
  SELECT array_agg(e.id) INTO v_empresa_ids
  FROM public.empresas e
  WHERE e.marca = v_marca AND e.uf = v_uf
    AND (NOT (p_filtros ? 'lojas')
         OR e.nome_empresa = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'lojas'))));

  IF v_empresa_ids IS NULL OR array_length(v_empresa_ids,1) IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.empresa_id, p.codigo_proposta, p.telefone, p.nome_cliente,
    p.email_cliente, p.origem, p.canal, p.veiculo_interesse,
    p.motivo_nao_venda, p.status_crm, p.lead_maia, p.lead_pri,
    p.criado_em_origem, p.codigo_loja, p.cnpj_loja, e.nome_empresa
  FROM public.pool_clientes_externos p
  JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.empresa_id = ANY (v_empresa_ids)
    AND COALESCE(p.status,'ativo') = 'ativo'
    AND p.telefone IS NOT NULL AND p.telefone <> ''
    AND (NOT (p_filtros ? 'dias_atras') OR p.criado_em_origem >= (NOW() - ((p_filtros->>'dias_atras')::int || ' days')::interval))
    AND (NOT (p_filtros ? 'ddds')       OR LEFT(p.telefone_digits, 2) = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'ddds'))))
    AND (NOT (p_filtros ? 'motivos')    OR p.motivo_nao_venda = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'motivos'))))
    AND (NOT (p_filtros ? 'status_crm') OR p.status_crm = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'status_crm'))))
    AND (NOT (p_filtros ? 'origens')    OR p.origem = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'origens'))))
    AND (NOT (p_filtros ? 'canais')     OR p.canal = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'canais'))))
    AND (NOT (p_filtros ? 'veiculos')   OR p.veiculo_interesse = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'veiculos'))))
    AND (NOT (p_filtros ? 'lead_maia')  OR (p_filtros->>'lead_maia')::boolean = COALESCE(p.lead_maia,'false')::boolean)
    AND (NOT (p_filtros ? 'lead_pri')   OR (p_filtros->>'lead_pri')::boolean = COALESCE(p.lead_pri,'false')::boolean)
  ORDER BY p.criado_em_origem DESC NULLS LAST
  LIMIT p_limit;
END;
$function$;

-- ===== RPC: get_pool_facets_for_empresa (single-pass) =====
CREATE OR REPLACE FUNCTION public.get_pool_facets_for_empresa(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_marca TEXT;
  v_uf TEXT;
  v_empresa_ids uuid[];
  v_result JSONB;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT e.marca, e.uf INTO v_marca, v_uf FROM public.empresas e WHERE e.id = p_empresa_id;
  IF v_marca IS NULL OR v_uf IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT array_agg(id) INTO v_empresa_ids
  FROM public.empresas WHERE marca = v_marca AND uf = v_uf;

  IF v_empresa_ids IS NULL THEN
    RETURN jsonb_build_object('marca', v_marca, 'uf', v_uf, 'total', 0);
  END IF;

  WITH base AS (
    SELECT p.criado_em_origem, p.telefone_digits, p.motivo_nao_venda, p.status_crm,
           p.origem, p.canal, p.veiculo_interesse, e.nome_empresa AS loja_nome
    FROM public.pool_clientes_externos p
    JOIN public.empresas e ON e.id = p.empresa_id
    WHERE p.empresa_id = ANY (v_empresa_ids)
      AND COALESCE(p.status,'ativo') = 'ativo'
      AND p.telefone IS NOT NULL AND p.telefone <> ''
  ),
  agg AS (
    SELECT
      COUNT(*) AS total,
      MIN(criado_em_origem) AS data_min,
      MAX(criado_em_origem) AS data_max,
      array_agg(DISTINCT LEFT(telefone_digits,2)) FILTER (WHERE telefone_digits IS NOT NULL AND telefone_digits <> '') AS ddds,
      array_agg(DISTINCT motivo_nao_venda) FILTER (WHERE motivo_nao_venda IS NOT NULL AND motivo_nao_venda <> '') AS motivos,
      array_agg(DISTINCT status_crm)       FILTER (WHERE status_crm IS NOT NULL AND status_crm <> '')             AS status_crm,
      array_agg(DISTINCT origem)           FILTER (WHERE origem IS NOT NULL AND origem <> '')                     AS origens,
      array_agg(DISTINCT canal)            FILTER (WHERE canal IS NOT NULL AND canal <> '')                       AS canais,
      array_agg(DISTINCT veiculo_interesse) FILTER (WHERE veiculo_interesse IS NOT NULL AND veiculo_interesse <> '') AS veiculos,
      array_agg(DISTINCT loja_nome)        FILTER (WHERE loja_nome IS NOT NULL AND loja_nome <> '')               AS lojas
    FROM base
  )
  SELECT jsonb_build_object(
    'marca', v_marca, 'uf', v_uf,
    'total', total, 'data_min', data_min, 'data_max', data_max,
    'ddds',       COALESCE(to_jsonb(ddds),       '[]'::jsonb),
    'motivos',    COALESCE(to_jsonb(motivos),    '[]'::jsonb),
    'status_crm', COALESCE(to_jsonb(status_crm), '[]'::jsonb),
    'origens',    COALESCE(to_jsonb(origens),    '[]'::jsonb),
    'canais',     COALESCE(to_jsonb(canais),     '[]'::jsonb),
    'veiculos',   COALESCE(to_jsonb(veiculos),   '[]'::jsonb),
    'lojas',      COALESCE(to_jsonb(lojas),      '[]'::jsonb)
  ) INTO v_result
  FROM agg;

  RETURN v_result;
END;
$function$;
