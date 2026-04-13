CREATE OR REPLACE FUNCTION public.increment_tentativas_chamada(p_contato_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE contatos
  SET tentativas_chamada = tentativas_chamada + 1,
      updated_at = now()
  WHERE id = p_contato_id;
$$;