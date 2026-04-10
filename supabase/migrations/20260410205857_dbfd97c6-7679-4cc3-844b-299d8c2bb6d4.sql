CREATE OR REPLACE FUNCTION public.fn_timeline_anotacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_nome text;
BEGIN
  IF NEW.tipo_evento::text = 'Anotação' THEN
    -- observacoes contains the user_id who created the annotation
    IF NEW.observacoes IS NOT NULL AND NEW.observacoes::text ~ '^[0-9a-f\-]{36}$' THEN
      SELECT COALESCE(p.nome_completo, 'Sistema') INTO v_nome
      FROM public.profiles p WHERE p.id = NEW.observacoes::uuid;
    END IF;
    v_nome := COALESCE(v_nome, 'Sistema');

    INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_id, usuario_nome, created_at)
    VALUES (
      NEW.contato_id,
      'anotacao',
      'Anotação adicionada por ' || v_nome,
      jsonb_build_object('evento_id', NEW.id, 'resultado', NEW.resultado),
      CASE WHEN NEW.observacoes ~ '^[0-9a-f\-]{36}$' THEN NEW.observacoes::uuid ELSE NULL END,
      v_nome,
      COALESCE(NEW.data_evento, now())
    );
  END IF;
  RETURN NEW;
END;
$$;