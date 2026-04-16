-- Feature flag
INSERT INTO system_feature_flags (flag_key, flag_label, description, category, scope, is_enabled)
VALUES (
  'relatorio_leads_convidados',
  'Relatório de Leads Convidados',
  'Permite extrair relatório de leads que foram convidados, com filtro por data. Ativado por loja.',
  'Relatórios',
  'per_empresa',
  false
)
ON CONFLICT (flag_key) DO NOTHING;

-- Índice parcial para performance
CREATE INDEX IF NOT EXISTS idx_logs_movimentacao_status_convidado
ON logs_movimentacao_contatos (status_novo, data_movimentacao)
WHERE status_novo IN ('Convidado', 'convidados');

-- RPC de relatório
CREATE OR REPLACE FUNCTION public.get_relatorio_convidados(
  p_empresa_id uuid,
  p_date_start timestamptz DEFAULT NULL,
  p_date_end timestamptz DEFAULT NULL,
  p_prospeccao_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  contato_id uuid,
  lead_id integer,
  nome text,
  telefone text,
  email text,
  status_atual text,
  data_convite timestamptz,
  convidado_por uuid,
  convidado_por_nome text,
  evento_nome text,
  prospeccao_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (lm.contato_id, lm.prospeccao_id)
    c.id as contato_id,
    c.lead_id,
    c.nome,
    c.telefone,
    c.email,
    c.status::text as status_atual,
    lm.data_movimentacao as data_convite,
    lm.usuario_id as convidado_por,
    p.nome_completo as convidado_por_nome,
    pr.titulo as evento_nome,
    lm.prospeccao_id
  FROM logs_movimentacao_contatos lm
  JOIN contatos c ON c.id = lm.contato_id
  LEFT JOIN profiles p ON p.id = lm.usuario_id
  LEFT JOIN prospeccoes pr ON pr.id = lm.prospeccao_id
  WHERE lm.status_novo IN ('Convidado', 'convidados')
    AND c.empresa_id = p_empresa_id
    AND (p_date_start IS NULL OR lm.data_movimentacao >= p_date_start)
    AND (p_date_end IS NULL OR lm.data_movimentacao <= p_date_end)
    AND (p_prospeccao_ids IS NULL OR lm.prospeccao_id = ANY(p_prospeccao_ids))
    AND COALESCE(
      (SELECT ffe.is_enabled
       FROM feature_flag_empresas ffe
       JOIN system_feature_flags sff ON sff.id = ffe.flag_id
       WHERE sff.flag_key = 'relatorio_leads_convidados'
         AND ffe.empresa_id = p_empresa_id
       LIMIT 1),
      false
    ) = true
  ORDER BY lm.contato_id, lm.prospeccao_id, lm.data_movimentacao DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_relatorio_convidados(uuid, timestamptz, timestamptz, uuid[]) TO authenticated;