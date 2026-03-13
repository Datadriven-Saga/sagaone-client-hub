WITH target(phone_11) AS (
  VALUES
    ('62999001697'),
    ('62999199312'),
    ('62999205245'),
    ('62999016844'),
    ('62999237569'),
    ('62999310242')
), variants AS (
  SELECT '55' || phone_11 AS telefone FROM target
  UNION ALL
  SELECT '+55' || phone_11 AS telefone FROM target
)
INSERT INTO public.quarentena_exclusoes (telefone_normalizado, motivo, criado_por)
SELECT v.telefone, 'Whitelist permanente - variação de formato', auth.uid()
FROM variants v
WHERE NOT EXISTS (
  SELECT 1
  FROM public.quarentena_exclusoes q
  WHERE q.telefone_normalizado = v.telefone
);