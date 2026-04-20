-- Índice parcial para a coluna "Novo" (leads não atribuídos) — maior gargalo
CREATE INDEX IF NOT EXISTS idx_contatos_empresa_status_unassigned
ON public.contatos (empresa_id, status)
WHERE responsavel_email IS NULL AND vendedor_nome IS NULL;

-- Índice para lookup de membros de equipe por usuário
CREATE INDEX IF NOT EXISTS idx_prospeccao_equipe_membros_user_id
ON public.prospeccao_equipe_membros (user_id);

-- RPC: retorna prospecções ativas onde o usuário é membro de equipe
CREATE OR REPLACE FUNCTION public.get_prospeccoes_usuario(
  p_user_id uuid,
  p_empresa_id uuid
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT p.id), '{}'::uuid[])
  FROM prospeccoes p
  JOIN prospeccao_equipes pe ON pe.prospeccao_id = p.id
  JOIN prospeccao_equipe_membros pem ON pem.equipe_id = pe.id
  WHERE pem.user_id = p_user_id
    AND p.empresa_id = p_empresa_id
    AND COALESCE(p.ativo, true) = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_prospeccoes_usuario(uuid, uuid) TO authenticated;

ANALYZE public.contatos;