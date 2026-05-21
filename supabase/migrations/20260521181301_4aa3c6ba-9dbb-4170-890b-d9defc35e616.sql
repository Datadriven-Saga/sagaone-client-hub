CREATE OR REPLACE FUNCTION public.fn_contato_anotacao_to_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  SELECT COALESCE(p.nome_completo, 'Usuário') INTO v_nome
  FROM public.profiles p WHERE p.id = NEW.usuario_id;
  v_nome := COALESCE(v_nome, 'Usuário');

  INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_id, usuario_nome, created_at)
  VALUES (
    NEW.contato_id,
    'anotacao',
    'Anotação adicionada por ' || v_nome,
    jsonb_build_object('anotacao_id', NEW.id, 'prospeccao_id', NEW.prospeccao_id),
    NEW.usuario_id,
    v_nome,
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contato_anotacao_timeline ON public.contato_anotacoes;
CREATE TRIGGER trg_contato_anotacao_timeline
AFTER INSERT ON public.contato_anotacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_contato_anotacao_to_timeline();