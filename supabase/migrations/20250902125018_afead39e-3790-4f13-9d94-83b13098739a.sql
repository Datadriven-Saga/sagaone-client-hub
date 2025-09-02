-- Garantir que existe uma empresa padrão
INSERT INTO public.empresas (id, nome_empresa, razao_social, cnpj)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Empresa Padrão',
  'Empresa Padrão LTDA',
  '00.000.000/0001-00'
)
ON CONFLICT (id) DO NOTHING;

-- Atualizar todos os perfis existentes para ter empresa_id
UPDATE public.profiles 
SET empresa_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE empresa_id IS NULL;