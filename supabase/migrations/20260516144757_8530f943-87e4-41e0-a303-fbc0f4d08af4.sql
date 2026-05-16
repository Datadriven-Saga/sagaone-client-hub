UPDATE public.departamento_permissoes
SET ativo = false
WHERE permissao = 'canAccessRelatorios'
  AND departamento NOT IN ('Administrador', 'Master');

INSERT INTO public.departamento_permissoes (departamento, permissao, ativo)
VALUES ('Administrador', 'canAccessRelatorios', true), ('Master', 'canAccessRelatorios', true)
ON CONFLICT (departamento, permissao) DO UPDATE SET ativo = true;