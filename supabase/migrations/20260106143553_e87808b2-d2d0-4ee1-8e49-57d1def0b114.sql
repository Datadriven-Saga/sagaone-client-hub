-- Migração para remover 'Outros' e 'Busca' e adicionar 'CRM' e 'Recepcionista'
-- Parte 1: Atualizar usuários existentes que usam perfis a serem removidos
UPDATE public.profiles 
SET tipo_acesso = 'Vendedor' 
WHERE tipo_acesso IN ('Outros', 'Busca');

-- Parte 2: Adicionar os novos valores ao enum existente (abordagem mais segura)
ALTER TYPE public.tipo_acesso ADD VALUE IF NOT EXISTS 'CRM';
ALTER TYPE public.tipo_acesso ADD VALUE IF NOT EXISTS 'Recepcionista';