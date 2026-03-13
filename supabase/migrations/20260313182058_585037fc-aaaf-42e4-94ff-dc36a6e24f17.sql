
-- Inserir na lista de exclusões (permitindo importação livre)
INSERT INTO public.quarentena_exclusoes (telefone_normalizado, motivo)
VALUES 
  ('62999001697', 'Teste - Sabrina'),
  ('62999199312', 'Teste - Moises'),
  ('62999205245', 'Teste - Mayara'),
  ('62999016844', 'Teste - Maria'),
  ('62999237569', 'Teste - Rainny'),
  ('62999310242', 'Teste - Ellen')
ON CONFLICT (telefone_normalizado) DO UPDATE SET
  motivo = EXCLUDED.motivo;
