
-- 1) Seed das duas novas permission keys em departamento_permissoes
-- canImportPoolFull: ativo para Master, Administrador, CRM
INSERT INTO public.departamento_permissoes (departamento, permissao, ativo, valor)
SELECT t, 'canImportPoolFull', true, jsonb_build_object('dias_max', NULL)
FROM (VALUES ('Master'),('Administrador'),('CRM')) AS x(t)
ON CONFLICT (departamento, permissao) DO NOTHING;

INSERT INTO public.departamento_permissoes (departamento, permissao, ativo, valor)
SELECT t, 'canImportPoolFull', false, jsonb_build_object('dias_max', 90)
FROM (VALUES ('SDR'),('Vendedor'),('Recepcionista'),('Gerente de Leads'),('Gerente de Loja'),('Coordenadora de Leads'),('Diretor'),('TI'),('Proprietário')) AS x(t)
ON CONFLICT (departamento, permissao) DO NOTHING;

-- canImportPoolReadOnly: desabilitado para todos por padrão
INSERT INTO public.departamento_permissoes (departamento, permissao, ativo, valor)
SELECT t, 'canImportPoolReadOnly', false, jsonb_build_object('dias_max', 90, 'eventos_permitidos', 'todos')
FROM (VALUES ('Master'),('Administrador'),('CRM'),('SDR'),('Vendedor'),('Recepcionista'),('Gerente de Leads'),('Gerente de Loja'),('Coordenadora de Leads'),('Diretor'),('TI'),('Proprietário')) AS x(t)
ON CONFLICT (departamento, permissao) DO NOTHING;

-- 2) Reescreve get_pool_clientes_for_empresa com paginação keyset + total
DROP FUNCTION IF EXISTS public.get_pool_clientes_for_empresa(uuid, jsonb, integer);

CREATE OR REPLACE FUNCTION public.get_pool_clientes_for_empresa(
  p_empresa_id uuid,
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 200,
  p_cursor_data timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_with_total boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_marca TEXT;
  v_uf TEXT;
  v_empresa_ids uuid[];
  v_items jsonb;
  v_total bigint := NULL;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT e.marca, e.uf INTO v_marca, v_uf FROM public.empresas e WHERE e.id = p_empresa_id;
  IF v_marca IS NULL OR v_uf IS NULL THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total',0);
  END IF;

  SELECT array_agg(e.id) INTO v_empresa_ids
  FROM public.empresas e
  WHERE e.marca = v_marca AND e.uf = v_uf
    AND (NOT (p_filtros ? 'lojas')
         OR e.nome_empresa = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'lojas'))));

  IF v_empresa_ids IS NULL OR array_length(v_empresa_ids,1) IS NULL THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total',0);
  END IF;

  WITH filtered AS (
    SELECT p.id, p.empresa_id, p.codigo_proposta, p.telefone, p.nome_cliente,
      p.email_cliente, p.origem, p.canal, p.veiculo_interesse,
      p.motivo_nao_venda, p.status_crm, p.lead_maia, p.lead_pri,
      p.criado_em_origem, p.codigo_loja, p.cnpj_loja, e.nome_empresa AS loja_nome
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
  )
  SELECT
    COALESCE(jsonb_agg(row_to_json(pg)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT *
    FROM filtered
    WHERE (p_cursor_data IS NULL
           OR (criado_em_origem, id) < (p_cursor_data, p_cursor_id))
    ORDER BY criado_em_origem DESC NULLS LAST, id DESC
    LIMIT p_limit
  ) pg;

  IF p_with_total THEN
    -- recomputa o total apenas quando solicitado (primeira página)
    SELECT COUNT(*) INTO v_total
    FROM public.pool_clientes_externos p
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
      AND (NOT (p_filtros ? 'lead_pri')   OR (p_filtros->>'lead_pri')::boolean = COALESCE(p.lead_pri,'false')::boolean);
  END IF;

  RETURN jsonb_build_object('items', v_items, 'total', v_total);
END;
$function$;

-- 3) Índice extra para suportar o keyset (criado_em_origem DESC, id DESC) por empresa
CREATE INDEX IF NOT EXISTS idx_pool_clientes_keyset
  ON public.pool_clientes_externos (empresa_id, criado_em_origem DESC, id DESC)
  WHERE COALESCE(status,'ativo') = 'ativo' AND telefone IS NOT NULL AND telefone <> '';
