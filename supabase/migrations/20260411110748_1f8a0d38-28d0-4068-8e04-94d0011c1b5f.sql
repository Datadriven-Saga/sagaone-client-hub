-- 1. Add dedicated usuario_id column
ALTER TABLE public.eventos_prospeccao
ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_eventos_prospeccao_usuario_id
ON public.eventos_prospeccao(usuario_id);

-- 2. Backfill from observacoes where it contains a valid UUID matching profiles
UPDATE public.eventos_prospeccao
SET usuario_id = observacoes::uuid
WHERE usuario_id IS NULL
  AND observacoes IS NOT NULL
  AND observacoes ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = observacoes::uuid);

-- 3. Update timeline trigger to use usuario_id instead of observacoes
CREATE OR REPLACE FUNCTION public.fn_timeline_anotacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_nome text;
BEGIN
  IF NEW.tipo_evento::text = 'Anotação' THEN
    -- Use the dedicated usuario_id column
    IF NEW.usuario_id IS NOT NULL THEN
      SELECT COALESCE(p.nome_completo, 'Usuário') INTO v_nome
      FROM public.profiles p WHERE p.id = NEW.usuario_id;
    END IF;
    v_nome := COALESCE(v_nome, 'Usuário');

    INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_id, usuario_nome, created_at)
    VALUES (
      NEW.contato_id,
      'anotacao',
      'Anotação adicionada por ' || v_nome,
      jsonb_build_object('evento_id', NEW.id),
      NEW.usuario_id,
      v_nome,
      COALESCE(NEW.data_evento, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Fix existing contato_timeline entries that say "Sistema" for annotations with known authors
UPDATE public.contato_timeline ct
SET usuario_nome = p.nome_completo,
    descricao = 'Anotação adicionada por ' || p.nome_completo,
    usuario_id = ep.usuario_id
FROM public.eventos_prospeccao ep
JOIN public.profiles p ON p.id = ep.usuario_id
WHERE ct.tipo = 'anotacao'
  AND ct.metadata->>'evento_id' IS NOT NULL
  AND ct.metadata->>'evento_id' = ep.id::text
  AND ep.usuario_id IS NOT NULL
  AND (ct.usuario_nome = 'Sistema' OR ct.usuario_nome IS NULL);