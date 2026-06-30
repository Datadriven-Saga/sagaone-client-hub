
-- ========================================================================
-- Liberar Segmentar Base (Pool / DataLake) com paridade de governança
-- ========================================================================

-- 1) Remove permissão legada canImportPool (substituída por Full / ReadOnly)
DELETE FROM public.departamento_permissoes WHERE permissao = 'canImportPool';

-- 2) Helper interno: marca → marca_api (PEUGEOT/CITROEN/CITROËN → FRANCE)
CREATE OR REPLACE FUNCTION public.pool_marca_to_api(p_marca text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(trim(p_marca),''))
    WHEN 'PEUGEOT'  THEN 'FRANCE'
    WHEN 'CITROEN'  THEN 'FRANCE'
    WHEN 'CITROËN'  THEN 'FRANCE'
    ELSE upper(coalesce(trim(p_marca),''))
  END
$$;

-- 3) Helper: resolve a permissão efetiva de Pool do usuário autenticado.
--    Retorna jsonb {kind: 'full'|'readonly'|'none', dias_max:int|null, eventos_permitidos:text}
CREATE OR REPLACE FUNCTION public.get_pool_permission(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_full record;
  v_ro record;
BEGIN
  IF p_user IS NULL THEN
    RETURN jsonb_build_object('kind','none','dias_max',NULL,'eventos_permitidos','todos');
  END IF;

  SELECT tipo_acesso::text INTO v_tipo FROM public.profiles WHERE id = p_user;
  IF v_tipo IS NULL THEN
    RETURN jsonb_build_object('kind','none','dias_max',NULL,'eventos_permitidos','todos');
  END IF;

  -- Master sempre tem Full ilimitado
  IF v_tipo = 'Master' THEN
    RETURN jsonb_build_object('kind','full','dias_max',NULL,'eventos_permitidos','todos');
  END IF;

  SELECT ativo, valor INTO v_full
  FROM public.departamento_permissoes
  WHERE departamento = v_tipo AND permissao = 'canImportPoolFull';

  IF v_full.ativo IS TRUE THEN
    RETURN jsonb_build_object(
      'kind','full',
      'dias_max', (v_full.valor->>'dias_max')::int,
      'eventos_permitidos', COALESCE(v_full.valor->>'eventos_permitidos','todos')
    );
  END IF;

  SELECT ativo, valor INTO v_ro
  FROM public.departamento_permissoes
  WHERE departamento = v_tipo AND permissao = 'canImportPoolReadOnly';

  IF v_ro.ativo IS TRUE THEN
    RETURN jsonb_build_object(
      'kind','readonly',
      'dias_max', (v_ro.valor->>'dias_max')::int,
      'eventos_permitidos', COALESCE(v_ro.valor->>'eventos_permitidos','todos')
    );
  END IF;

  RETURN jsonb_build_object('kind','none','dias_max',NULL,'eventos_permitidos','todos');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pool_permission(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pool_marca_to_api(text)   TO authenticated, service_role;

-- 4) get_pool_clientes_for_empresa: clampa dias_max e mascara telefone p/ ReadOnly
CREATE OR REPLACE FUNCTION public.get_pool_clientes_for_empresa(
  p_empresa_id uuid,
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 200,
  p_cursor_data timestamp with time zone DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_with_total boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_marca TEXT;
  v_uf TEXT;
  v_empresa_ids uuid[];
  v_items jsonb;
  v_total bigint := NULL;
  v_perm jsonb;
  v_kind text;
  v_dias_max int;
  v_dias_eff int;
  v_mask boolean;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_perm    := public.get_pool_permission(auth.uid());
  v_kind    := v_perm->>'kind';
  IF v_kind = 'none' THEN
    RAISE EXCEPTION 'Sem permissão para Segmentar Base';
  END IF;
  v_dias_max := NULLIF(v_perm->>'dias_max','')::int;
  v_mask     := (v_kind = 'readonly');

  -- Clampa o dias_atras solicitado pelo limite do usuário
  IF (p_filtros ? 'dias_atras') THEN
    v_dias_eff := (p_filtros->>'dias_atras')::int;
    IF v_dias_max IS NOT NULL THEN
      v_dias_eff := LEAST(v_dias_eff, v_dias_max);
    END IF;
  ELSIF v_dias_max IS NOT NULL THEN
    v_dias_eff := v_dias_max;
  ELSE
    v_dias_eff := NULL;
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
    SELECT p.id, p.empresa_id, p.codigo_proposta,
      CASE WHEN v_mask THEN LEFT(coalesce(p.telefone_digits,''),4) || '****' ELSE p.telefone END AS telefone,
      p.nome_cliente, p.email_cliente, p.origem, p.canal, p.veiculo_interesse,
      p.motivo_nao_venda, p.status_crm, p.lead_maia, p.lead_pri,
      p.criado_em_origem, p.codigo_loja, p.cnpj_loja, e.nome_empresa AS loja_nome
    FROM public.pool_clientes_externos p
    JOIN public.empresas e ON e.id = p.empresa_id
    WHERE p.empresa_id = ANY (v_empresa_ids)
      AND COALESCE(p.status,'ativo') = 'ativo'
      AND p.telefone IS NOT NULL AND p.telefone <> ''
      AND (v_dias_eff IS NULL OR p.criado_em_origem >= (NOW() - (v_dias_eff || ' days')::interval))
      AND (NOT (p_filtros ? 'ddds')       OR LEFT(p.telefone_digits, 2) = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'ddds'))))
      AND (NOT (p_filtros ? 'motivos')    OR p.motivo_nao_venda = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'motivos'))))
      AND (NOT (p_filtros ? 'status_crm') OR p.status_crm = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'status_crm'))))
      AND (NOT (p_filtros ? 'origens')    OR p.origem = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'origens'))))
      AND (NOT (p_filtros ? 'canais')     OR p.canal = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'canais'))))
      AND (NOT (p_filtros ? 'veiculos')   OR p.veiculo_interesse = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'veiculos'))))
      AND (NOT (p_filtros ? 'lead_maia')  OR (p_filtros->>'lead_maia')::boolean = COALESCE(p.lead_maia,'false')::boolean)
      AND (NOT (p_filtros ? 'lead_pri')   OR (p_filtros->>'lead_pri')::boolean = COALESCE(p.lead_pri,'false')::boolean)
  )
  SELECT COALESCE(jsonb_agg(row_to_json(pg)), '[]'::jsonb)
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
    SELECT COUNT(*) INTO v_total
    FROM public.pool_clientes_externos p
    WHERE p.empresa_id = ANY (v_empresa_ids)
      AND COALESCE(p.status,'ativo') = 'ativo'
      AND p.telefone IS NOT NULL AND p.telefone <> ''
      AND (v_dias_eff IS NULL OR p.criado_em_origem >= (NOW() - (v_dias_eff || ' days')::interval))
      AND (NOT (p_filtros ? 'ddds')       OR LEFT(p.telefone_digits, 2) = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'ddds'))))
      AND (NOT (p_filtros ? 'motivos')    OR p.motivo_nao_venda = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'motivos'))))
      AND (NOT (p_filtros ? 'status_crm') OR p.status_crm = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'status_crm'))))
      AND (NOT (p_filtros ? 'origens')    OR p.origem = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'origens'))))
      AND (NOT (p_filtros ? 'canais')     OR p.canal = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'canais'))))
      AND (NOT (p_filtros ? 'veiculos')   OR p.veiculo_interesse = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filtros->'veiculos'))))
      AND (NOT (p_filtros ? 'lead_maia')  OR (p_filtros->>'lead_maia')::boolean = COALESCE(p.lead_maia,'false')::boolean)
      AND (NOT (p_filtros ? 'lead_pri')   OR (p_filtros->>'lead_pri')::boolean = COALESCE(p.lead_pri,'false')::boolean);
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'dias_max_efetivo', v_dias_max,
    'dias_atras_aplicado', v_dias_eff,
    'modo', v_kind
  );
END;
$function$;

-- 5) importar_pool_para_evento — paridade total com planilha
CREATE OR REPLACE FUNCTION public.importar_pool_para_evento(
  p_empresa_id uuid,
  p_prospeccao_id uuid,
  p_itens jsonb,
  p_segmentacao_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_inserted INT := 0; v_updated INT := 0; v_linked INT := 0;
  v_already_linked INT := 0; v_errors INT := 0;
  v_blk_quarentena INT := 0; v_blk_optout_g INT := 0; v_blk_optout_ext INT := 0;
  v_blk_janela INT := 0; v_blk_evento INT := 0;
  v_item RECORD;
  v_contato_id UUID;
  v_is_new BOOLEAN;
  v_already BOOLEAN;
  v_pool_id UUID;
  v_telefone TEXT;
  v_phone_variants TEXT[];
  v_marca TEXT; v_uf TEXT;
  v_data_fim DATE;
  v_bypass BOOLEAN := false;
  v_is_teste BOOLEAN := false;
  v_evento_nome TEXT;
  v_quarentena_enabled BOOLEAN;
  v_quarentena_dias INT;
  v_perm JSONB;
  v_kind TEXT;
  v_dias_max INT;
  v_eventos_permitidos TEXT;
  v_in_quarantine BOOLEAN;
  v_is_global BOOLEAN;
  v_is_ext_optout BOOLEAN;
  v_apimarca TEXT;
  v_snapshot_id UUID;
  v_total INT;
  v_pool_criado_em TIMESTAMPTZ;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF p_prospeccao_id IS NULL THEN RAISE EXCEPTION 'prospeccao_id obrigatório'; END IF;

  v_perm := public.get_pool_permission(auth.uid());
  v_kind := v_perm->>'kind';
  IF v_kind = 'none' THEN RAISE EXCEPTION 'Sem permissão para Segmentar Base'; END IF;
  v_dias_max := NULLIF(v_perm->>'dias_max','')::int;
  v_eventos_permitidos := COALESCE(v_perm->>'eventos_permitidos','todos');

  -- Carrega contexto da empresa e do evento
  SELECT e.marca, e.uf, COALESCE(e.bypass_compliance,false)
  INTO v_marca, v_uf, v_bypass
  FROM public.empresas e WHERE e.id = p_empresa_id;

  SELECT p.data_fim, p.titulo, COALESCE(p.is_teste,false)
  INTO v_data_fim, v_evento_nome, v_is_teste
  FROM public.prospeccoes p WHERE p.id = p_prospeccao_id;

  IF v_data_fim IS NULL THEN
    RAISE EXCEPTION 'Evento sem data_fim';
  END IF;

  -- ReadOnly + eventos_permitidos='futuros': bloqueia eventos já encerrados
  IF v_kind = 'readonly' AND v_eventos_permitidos = 'futuros' AND v_data_fim < CURRENT_DATE THEN
    v_total := jsonb_array_length(p_itens);
    RETURN jsonb_build_object(
      'inserted',0,'updated',0,'linked',0,'already_linked',0,'errors',0,
      'blocked_quarentena',0,'blocked_optout_global',0,'blocked_optout_externo',0,
      'blocked_janela',0,'blocked_evento_encerrado',v_total,'total',v_total,
      'message','Evento encerrado — perfil ReadOnly só pode importar para eventos em andamento ou futuros'
    );
  END IF;

  v_quarentena_enabled := public.is_feature_enabled('quarentena_marca_ativa');
  IF v_bypass THEN v_quarentena_enabled := false; END IF;
  v_quarentena_dias    := public.get_quarentena_dias(p_empresa_id, v_marca, 'whatsapp');

  -- Snapshot de opt-out externo válido para hoje (SP). Se não houver, ignora (não bloqueia silenciosamente).
  v_apimarca := public.pool_marca_to_api(v_marca);
  SELECT s.id INTO v_snapshot_id
  FROM public.external_optout_snapshots s
  WHERE s.marca_api = v_apimarca
    AND s.uf        = upper(v_uf)
    AND s.status    = 'ready'
    AND s.valid_until_date_sp = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY s.fetched_at DESC
  LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    BEGIN
      v_pool_id  := NULLIF(v_item.value->>'pool_id','')::uuid;
      v_telefone := COALESCE(v_item.value->>'telefone','');
      v_phone_variants := public.phone_match_variants(v_telefone);

      -- Janela (dias_max) — usa criado_em_origem do pool quando disponível
      v_pool_criado_em := NULL;
      IF v_pool_id IS NOT NULL AND v_dias_max IS NOT NULL THEN
        SELECT criado_em_origem INTO v_pool_criado_em
        FROM public.pool_clientes_externos WHERE id = v_pool_id;
        IF v_pool_criado_em IS NULL OR v_pool_criado_em < (NOW() - (v_dias_max || ' days')::interval) THEN
          v_blk_janela := v_blk_janela + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Opt-out global (sem bypass)
      IF NOT v_bypass THEN
        v_is_global := public.check_global_opt_out(v_telefone);
        IF v_is_global THEN v_blk_optout_g := v_blk_optout_g + 1; CONTINUE; END IF;
      END IF;

      -- Opt-out externo (sem bypass, só se houver snapshot do dia)
      IF NOT v_bypass AND v_snapshot_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.external_optout_entries e
          WHERE e.snapshot_id = v_snapshot_id
            AND e.phone_normalized IS NOT NULL
            AND e.phone_normalized = ANY (v_phone_variants)
        ) INTO v_is_ext_optout;
        IF v_is_ext_optout THEN v_blk_optout_ext := v_blk_optout_ext + 1; CONTINUE; END IF;
      END IF;

      -- Quarentena por marca/canal (whatsapp, padrão de impacto)
      v_in_quarantine := false;
      IF v_quarentena_enabled AND v_marca IS NOT NULL AND NOT v_is_teste THEN
        IF NOT EXISTS (SELECT 1 FROM public.quarentena_exclusoes WHERE telefone_normalizado = ANY (v_phone_variants)) THEN
          SELECT CASE
                   WHEN cq.id IS NOT NULL
                    AND cq.desativado = false
                    AND cq.data_fim_evento IS NOT NULL
                    AND now() > cq.data_fim_evento
                    AND now() < (cq.data_fim_evento + (v_quarentena_dias || ' days')::interval)
                   THEN true ELSE false END
            INTO v_in_quarantine
          FROM (SELECT 1) d
          LEFT JOIN LATERAL (
            SELECT cq2.*
            FROM public.contato_quarentena cq2
            WHERE cq2.telefone_normalizado = ANY (v_phone_variants)
              AND cq2.marca = v_marca
              AND cq2.canal = 'whatsapp'
            ORDER BY cq2.desativado ASC, cq2.data_fim_evento DESC NULLS LAST
            LIMIT 1
          ) cq ON true;
        END IF;
      END IF;
      IF v_in_quarantine THEN v_blk_quarentena := v_blk_quarentena + 1; CONTINUE; END IF;

      -- Upsert do contato
      INSERT INTO public.contatos (nome, telefone, email, status, origem, empresa_id, codigo_proposta)
      VALUES (
        COALESCE(v_item.value->>'nome',''),
        v_telefone,
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

      v_already := EXISTS (
        SELECT 1 FROM public.eventos_prospeccao
        WHERE contato_id = v_contato_id AND prospeccao_id = p_prospeccao_id
      );
      IF v_already THEN
        v_already_linked := v_already_linked + 1;
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
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  v_total := jsonb_array_length(p_itens);

  -- Auditoria: 1 entrada em logs_prospeccoes
  BEGIN
    INSERT INTO public.logs_prospeccoes (prospeccao_id, empresa_id, usuario_id, acao, detalhes)
    SELECT p_prospeccao_id, p_empresa_id, auth.uid(), 'importacao_pool',
           jsonb_build_object(
             'segmentacao_id', p_segmentacao_id,
             'modo', v_kind,
             'dias_max', v_dias_max,
             'eventos_permitidos', v_eventos_permitidos,
             'total', v_total,
             'inserted', v_inserted, 'updated', v_updated,
             'linked', v_linked, 'already_linked', v_already_linked,
             'blocked_quarentena', v_blk_quarentena,
             'blocked_optout_global', v_blk_optout_g,
             'blocked_optout_externo', v_blk_optout_ext,
             'blocked_janela', v_blk_janela,
             'errors', v_errors
           )::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'logs_prospeccoes insert falhou: %', SQLERRM;
  END;

  -- Auditoria: 1 entrada em import_logs com origem 'pool'
  BEGIN
    INSERT INTO public.import_logs (
      empresa_id, prospeccao_id, user_id, status, origem,
      total_rows, processed_rows, inserted, updated, linked, already_linked,
      errors, quarantined, message
    ) VALUES (
      p_empresa_id, p_prospeccao_id, auth.uid(), 'done', 'pool',
      v_total, v_total, v_inserted, v_updated, v_linked, v_already_linked,
      v_errors, v_blk_quarentena,
      format('pool segmentacao=%s opt_g=%s opt_ext=%s janela=%s', p_segmentacao_id, v_blk_optout_g, v_blk_optout_ext, v_blk_janela)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'import_logs insert falhou: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'inserted', v_inserted, 'updated', v_updated, 'linked', v_linked,
    'already_linked', v_already_linked, 'errors', v_errors,
    'blocked_quarentena', v_blk_quarentena,
    'blocked_optout_global', v_blk_optout_g,
    'blocked_optout_externo', v_blk_optout_ext,
    'blocked_janela', v_blk_janela,
    'blocked_evento_encerrado', 0,
    'total', v_total,
    'modo', v_kind
  );
END;
$function$;
