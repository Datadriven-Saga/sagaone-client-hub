
CREATE OR REPLACE FUNCTION public.get_pool_facets_for_empresa(p_empresa_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_marca TEXT; v_uf TEXT; v_result JSONB;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT e.marca, e.uf INTO v_marca, v_uf FROM public.empresas e WHERE e.id = p_empresa_id;

  WITH base AS (
    SELECT p.*, e.nome_empresa AS loja_nome FROM public.pool_clientes_externos p
    JOIN public.empresas e ON e.id = p.empresa_id
    WHERE e.marca = v_marca AND e.uf = v_uf
      AND COALESCE(p.status, 'ativo') = 'ativo'
      AND p.telefone IS NOT NULL AND p.telefone != ''
  )
  SELECT jsonb_build_object(
    'marca', v_marca, 'uf', v_uf,
    'total', (SELECT COUNT(*) FROM base),
    'ddds',       (SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb) FROM (SELECT LEFT(REGEXP_REPLACE(telefone,'[^0-9]','','g'), 2) AS x FROM base) s WHERE x IS NOT NULL AND x != ''),
    'motivos',    (SELECT COALESCE(jsonb_agg(DISTINCT motivo_nao_venda), '[]'::jsonb) FROM base WHERE motivo_nao_venda IS NOT NULL AND motivo_nao_venda != ''),
    'status_crm', (SELECT COALESCE(jsonb_agg(DISTINCT status_crm), '[]'::jsonb) FROM base WHERE status_crm IS NOT NULL AND status_crm != ''),
    'origens',    (SELECT COALESCE(jsonb_agg(DISTINCT origem), '[]'::jsonb) FROM base WHERE origem IS NOT NULL AND origem != ''),
    'canais',     (SELECT COALESCE(jsonb_agg(DISTINCT canal), '[]'::jsonb) FROM base WHERE canal IS NOT NULL AND canal != ''),
    'veiculos',   (SELECT COALESCE(jsonb_agg(DISTINCT veiculo_interesse), '[]'::jsonb) FROM base WHERE veiculo_interesse IS NOT NULL AND veiculo_interesse != ''),
    'lojas',      (SELECT COALESCE(jsonb_agg(DISTINCT loja_nome), '[]'::jsonb) FROM base WHERE loja_nome IS NOT NULL AND loja_nome != '')
  ) INTO v_result;
  RETURN v_result;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_pool_clientes_for_empresa(p_empresa_id uuid, p_filtros jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 5000)
 RETURNS TABLE(id uuid, empresa_id uuid, codigo_proposta text, telefone text, nome_cliente text, email_cliente text, origem text, canal text, veiculo_interesse text, motivo_nao_venda text, status_crm text, lead_maia text, lead_pri text, criado_em_origem timestamp with time zone, codigo_loja text, cnpj_loja text, loja_nome text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_marca TEXT; v_uf TEXT;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT e.marca, e.uf INTO v_marca, v_uf FROM public.empresas e WHERE e.id = p_empresa_id;
  IF v_marca IS NULL OR v_uf IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.empresa_id, p.codigo_proposta, p.telefone, p.nome_cliente,
    p.email_cliente, p.origem, p.canal, p.veiculo_interesse,
    p.motivo_nao_venda, p.status_crm, p.lead_maia, p.lead_pri,
    p.criado_em_origem, p.codigo_loja, p.cnpj_loja, e.nome_empresa
  FROM public.pool_clientes_externos p
  JOIN public.empresas e ON e.id = p.empresa_id
  WHERE e.marca = v_marca AND e.uf = v_uf
    AND COALESCE(p.status, 'ativo') = 'ativo'
    AND p.telefone IS NOT NULL AND p.telefone != ''
    AND (NOT (p_filtros ? 'ddds')        OR LEFT(REGEXP_REPLACE(COALESCE(p.telefone,''), '[^0-9]', '', 'g'), 2) = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'ddds'))))
    AND (NOT (p_filtros ? 'motivos')     OR p.motivo_nao_venda = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'motivos'))))
    AND (NOT (p_filtros ? 'status_crm')  OR p.status_crm = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'status_crm'))))
    AND (NOT (p_filtros ? 'origens')     OR p.origem = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'origens'))))
    AND (NOT (p_filtros ? 'canais')      OR p.canal = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'canais'))))
    AND (NOT (p_filtros ? 'veiculos')    OR p.veiculo_interesse = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'veiculos'))))
    AND (NOT (p_filtros ? 'lojas')       OR e.nome_empresa = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'lojas'))))
    AND (NOT (p_filtros ? 'lead_maia')   OR (p_filtros->>'lead_maia')::boolean = COALESCE(p.lead_maia,'false')::boolean)
    AND (NOT (p_filtros ? 'lead_pri')    OR (p_filtros->>'lead_pri')::boolean = COALESCE(p.lead_pri,'false')::boolean)
  ORDER BY p.criado_em_origem DESC NULLS LAST
  LIMIT p_limit;
END; $function$;
