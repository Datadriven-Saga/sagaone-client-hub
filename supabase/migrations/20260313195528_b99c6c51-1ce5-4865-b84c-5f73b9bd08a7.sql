-- 1) Garantir whitelist permanente (com variações de formato)
WITH target(nome, phone_11) AS (
  VALUES
    ('Sabrina', '62999001697'),
    ('Moises',  '62999199312'),
    ('Mayara',  '62999205245'),
    ('Maria',   '62999016844'),
    ('Rainny',  '62999237569'),
    ('Ellen',   '62999310242')
), variants AS (
  SELECT nome, phone_11 AS telefone FROM target
  UNION ALL
  SELECT nome, '55' || phone_11 FROM target
  UNION ALL
  SELECT nome, '+55' || phone_11 FROM target
)
INSERT INTO public.quarentena_exclusoes (telefone_normalizado, motivo, criado_por)
SELECT v.telefone, 'Whitelist permanente - ' || v.nome, auth.uid()
FROM variants v
WHERE NOT EXISTS (
  SELECT 1
  FROM public.quarentena_exclusoes q
  WHERE regexp_replace(q.telefone_normalizado, '\\D', '', 'g') = regexp_replace(v.telefone, '\\D', '', 'g')
);

-- 2) Liberar imediatamente qualquer bloqueio já existente desses números
WITH target(phone_11) AS (
  VALUES
    ('62999001697'),
    ('62999199312'),
    ('62999205245'),
    ('62999016844'),
    ('62999237569'),
    ('62999310242')
), updated AS (
  UPDATE public.contato_quarentena cq
  SET
    desativado = true,
    desativado_em = now(),
    desativado_por = auth.uid(),
    updated_at = now()
  WHERE right(regexp_replace(cq.telefone_normalizado, '\\D', '', 'g'), 11) IN (SELECT phone_11 FROM target)
    AND cq.desativado = false
  RETURNING cq.id, cq.telefone_normalizado, cq.marca, cq.empresa_id
)
INSERT INTO public.quarentena_logs (
  quarentena_id,
  telefone_normalizado,
  marca,
  empresa_id,
  acao,
  usuario_id,
  usuario_email,
  detalhes
)
SELECT
  u.id,
  u.telefone_normalizado,
  u.marca,
  u.empresa_id,
  'desativado_manual',
  auth.uid(),
  NULL,
  'Liberação automática por whitelist permanente (número de teste/exceção)'
FROM updated u;