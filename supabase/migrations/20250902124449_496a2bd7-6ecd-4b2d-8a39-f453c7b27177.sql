-- Criar um perfil para usuários existentes que não têm perfil
INSERT INTO public.profiles (id, nome_completo, tipo_acesso, empresa_id)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as nome_completo,
  'Administrador'::tipo_acesso,
  '00000000-0000-0000-0000-000000000001'::uuid as empresa_id
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- Criar empresa padrão se não existir
INSERT INTO public.empresas (id, nome_empresa, razao_social, cnpj)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Empresa Padrão',
  'Empresa Padrão LTDA',
  '00.000.000/0001-00'
)
ON CONFLICT (id) DO NOTHING;