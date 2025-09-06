-- Remover o módulo "Gatilhos" de todas as empresas
DELETE FROM public.empresa_modulos 
WHERE modulo_nome = 'Gatilhos';