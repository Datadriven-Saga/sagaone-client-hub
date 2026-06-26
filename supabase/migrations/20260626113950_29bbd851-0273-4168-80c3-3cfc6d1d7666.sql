
CREATE INDEX IF NOT EXISTS idx_contatos_tel_last4
  ON public.contatos (empresa_id, (right(regexp_replace(coalesce(telefone,''),'\D','','g'), 4)));

CREATE OR REPLACE FUNCTION public.buscar_contatos_por_sufixo_telefone(
  p_empresa_id uuid,
  p_sufixo text
)
RETURNS TABLE(id uuid, nome text, telefone text, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Valida acesso do usuário à empresa
  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à empresa %', p_empresa_id USING ERRCODE = '42501';
  END IF;

  -- Normaliza sufixo: apenas dígitos, exatamente 4
  p_sufixo := regexp_replace(coalesce(p_sufixo,''), '\D', '', 'g');
  IF length(p_sufixo) <> 4 THEN
    RAISE EXCEPTION 'Sufixo deve conter exatamente 4 dígitos' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT c.id, c.nome, c.telefone, c.status::text
  FROM public.contatos c
  WHERE c.empresa_id = p_empresa_id
    AND right(regexp_replace(coalesce(c.telefone,''),'\D','','g'), 4) = p_sufixo
  ORDER BY c.nome
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_contatos_por_sufixo_telefone(uuid, text) TO authenticated;
