
CREATE TABLE IF NOT EXISTS public.pool_segmentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  prospeccao_id UUID REFERENCES public.prospeccoes(id) ON DELETE SET NULL,
  criado_por UUID NOT NULL,
  nome TEXT NOT NULL,
  marca TEXT NOT NULL,
  uf TEXT NOT NULL,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_resultados INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pool_segmentacoes_marca_uf
  ON public.pool_segmentacoes (marca, uf, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pool_segmentacoes_empresa
  ON public.pool_segmentacoes (empresa_id, created_at DESC);

ALTER TABLE public.pool_segmentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pool_seg_select_by_empresa"
  ON public.pool_segmentacoes FOR SELECT
  USING (public.user_can_access_empresa(empresa_id, auth.uid()));

CREATE POLICY "pool_seg_insert_by_empresa"
  ON public.pool_segmentacoes FOR INSERT
  WITH CHECK (
    public.user_can_access_empresa(empresa_id, auth.uid())
    AND criado_por = auth.uid()
  );

CREATE POLICY "pool_seg_delete_by_owner_or_admin"
  ON public.pool_segmentacoes FOR DELETE
  USING (
    criado_por = auth.uid()
    OR public.check_user_is_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.get_pool_clientes_for_empresa(
  p_empresa_id UUID,
  p_filtros JSONB DEFAULT '{}'::jsonb,
  p_limit INT DEFAULT 5000
)
RETURNS TABLE (
  id UUID, empresa_id UUID, codigo_proposta TEXT, telefone TEXT, nome_cliente TEXT,
  email_cliente TEXT, origem TEXT, canal TEXT, veiculo_interesse TEXT,
  motivo_nao_venda TEXT, status_crm TEXT, lead_maia TEXT, lead_pri TEXT,
  criado_em_origem TIMESTAMPTZ, codigo_loja TEXT, cnpj_loja TEXT, loja_nome TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    AND (NOT (p_filtros ? 'lead_maia')   OR (p_filtros->>'lead_maia')::boolean = COALESCE(p.lead_maia,'false')::boolean)
    AND (NOT (p_filtros ? 'lead_pri')    OR (p_filtros->>'lead_pri')::boolean = COALESCE(p.lead_pri,'false')::boolean)
  ORDER BY p.criado_em_origem DESC NULLS LAST
  LIMIT p_limit;
END; $$;

CREATE OR REPLACE FUNCTION public.get_pool_facets_for_empresa(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_marca TEXT; v_uf TEXT; v_result JSONB;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT e.marca, e.uf INTO v_marca, v_uf FROM public.empresas e WHERE e.id = p_empresa_id;

  WITH base AS (
    SELECT p.* FROM public.pool_clientes_externos p
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
    'veiculos',   (SELECT COALESCE(jsonb_agg(DISTINCT veiculo_interesse), '[]'::jsonb) FROM base WHERE veiculo_interesse IS NOT NULL AND veiculo_interesse != '')
  ) INTO v_result;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.importar_pool_para_evento(
  p_empresa_id UUID, p_prospeccao_id UUID, p_itens JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_inserted INT := 0; v_updated INT := 0; v_linked INT := 0;
  v_already_linked INT := 0; v_errors INT := 0;
  v_item RECORD; v_contato_id UUID; v_is_new BOOLEAN; v_already BOOLEAN; v_pool_id UUID;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF p_prospeccao_id IS NULL THEN RAISE EXCEPTION 'prospeccao_id obrigatório'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    BEGIN
      v_pool_id := NULLIF(v_item.value->>'pool_id','')::uuid;

      INSERT INTO public.contatos (nome, telefone, email, status, origem, empresa_id, codigo_proposta)
      VALUES (
        COALESCE(v_item.value->>'nome',''),
        v_item.value->>'telefone',
        NULLIF(v_item.value->>'email',''),
        'Novo'::status_lead, 'Outros'::origem_lead, p_empresa_id,
        NULLIF(v_item.value->>'codigo_proposta','')
      )
      ON CONFLICT (telefone, empresa_id) WHERE telefone IS NOT NULL AND telefone != ''
      DO UPDATE SET
        nome = CASE WHEN COALESCE(EXCLUDED.nome,'') != '' THEN EXCLUDED.nome ELSE contatos.nome END,
        email = COALESCE(EXCLUDED.email, contatos.email),
        codigo_proposta = COALESCE(EXCLUDED.codigo_proposta, contatos.codigo_proposta),
        updated_at = now()
      RETURNING id, (xmax = 0) INTO v_contato_id, v_is_new;

      IF v_is_new THEN v_inserted := v_inserted + 1; ELSE v_updated := v_updated + 1; END IF;

      v_already := EXISTS (SELECT 1 FROM public.eventos_prospeccao
        WHERE contato_id = v_contato_id AND prospeccao_id = p_prospeccao_id);

      IF v_already THEN v_already_linked := v_already_linked + 1;
      ELSE
        INSERT INTO public.eventos_prospeccao (contato_id, prospeccao_id)
        VALUES (v_contato_id, p_prospeccao_id);
        v_linked := v_linked + 1;
      END IF;

      IF v_pool_id IS NOT NULL THEN
        UPDATE public.pool_clientes_externos
        SET importado_em_evento_ids = CASE
          WHEN importado_em_evento_ids IS NULL THEN ARRAY[p_prospeccao_id]
          WHEN p_prospeccao_id = ANY(importado_em_evento_ids) THEN importado_em_evento_ids
          ELSE array_append(importado_em_evento_ids, p_prospeccao_id) END,
          updated_at = now()
        WHERE id = v_pool_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted, 'updated', v_updated, 'linked', v_linked,
    'already_linked', v_already_linked, 'errors', v_errors,
    'total', jsonb_array_length(p_itens)
  );
END; $$;
