-- Remove all existing overrides for canUploadBase so only the code defaults apply
-- (Master and CRM only)
DELETE FROM public.departamento_permissoes WHERE permissao = 'canUploadBase';