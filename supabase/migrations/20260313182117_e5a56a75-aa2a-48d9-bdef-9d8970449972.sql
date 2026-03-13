
-- Remover quarentenas existentes para os 6 números de teste
DELETE FROM public.contato_quarentena 
WHERE telefone_normalizado IN (
  '62999001697', 
  '62999199312', 
  '62999205245', 
  '62999016844', 
  '62999237569', 
  '62999310242'
);
