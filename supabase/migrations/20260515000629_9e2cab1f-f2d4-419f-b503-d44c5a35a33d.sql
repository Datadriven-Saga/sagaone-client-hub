WITH primeiro_evento AS (
  SELECT DISTINCT ON (ep.contato_id) ep.id AS ep_id, ep.contato_id
  FROM public.eventos_prospeccao ep
  JOIN public.contatos c ON c.id = ep.contato_id
  WHERE c.confirmation_sent_at IS NOT NULL OR c.confirmed_at IS NOT NULL
  ORDER BY ep.contato_id, ep.created_at ASC NULLS LAST, ep.id ASC
)
UPDATE public.eventos_prospeccao ep
SET
  confirmation_token = COALESCE(c.confirmation_token, ep.confirmation_token),
  confirmation_sent_at = c.confirmation_sent_at,
  confirmation_sent_by = c.confirmation_sent_by,
  confirmed_at = c.confirmed_at,
  confirmation_expires_at = c.confirmation_expires_at
FROM public.contatos c, primeiro_evento pe
WHERE ep.id = pe.ep_id AND c.id = pe.contato_id;

ALTER TABLE public.contatos
  DROP COLUMN IF EXISTS confirmation_token,
  DROP COLUMN IF EXISTS confirmation_sent_at,
  DROP COLUMN IF EXISTS confirmation_sent_by,
  DROP COLUMN IF EXISTS confirmation_expires_at;