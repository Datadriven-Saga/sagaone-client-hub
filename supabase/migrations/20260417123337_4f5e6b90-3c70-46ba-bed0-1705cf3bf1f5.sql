CREATE OR REPLACE FUNCTION public.get_relatorio_convidados(
  p_empresa_id uuid,
  p_date_start timestamptz DEFAULT NULL,
  p_date_end timestamptz DEFAULT NULL,
  p_prospeccao_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  contato_id uuid,
  lead_id bigint,
  nome text,
  telefone text,
  email text,
  status_atual text,
  data_convite timestamptz,
  convidado_por uuid,
  convidado_por_nome text,
  eventos text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_feature_enabled_for_empresa('relatorio_leads_convidados', p_empresa_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (c.id)
    c.id as contato_id,
    c.lead_id,
    c.nome,
    c.telefone,
    c.email,
    c.status::text as status_atual,
    lm.data_movimentacao as data_convite,
    lm.usuario_id as convidado_por,
    p.nome_completo as convidado_por_nome,
    (
      SELECT array_agg(DISTINCT pr2.titulo)
      FROM logs_movimentacao_contatos lm2
      JOIN prospeccoes pr2 ON pr2.id = lm2.prospeccao_id
      WHERE lm2.contato_id = c.id
        AND lm2.status_novo IN ('Convidado', 'convidados')
    ) as eventos
  FROM logs_movimentacao_contatos lm
  JOIN contatos c ON c.id = lm.contato_id
  LEFT JOIN profiles p ON p.id = lm.usuario_id
  WHERE lm.status_novo IN ('Convidado', 'convidados')
    AND c.empresa_id = p_empresa_id
    AND (p_date_start IS NULL OR lm.data_movimentacao >= p_date_start)
    AND (p_date_end IS NULL OR lm.data_movimentacao <= p_date_end)
    AND (p_prospeccao_ids IS NULL OR lm.prospeccao_id = ANY(p_prospeccao_ids))
  ORDER BY c.id, lm.data_movimentacao DESC;
END;
$$;