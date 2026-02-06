
-- Adicionar novo tipo de acesso ao enum
ALTER TYPE public.tipo_acesso ADD VALUE IF NOT EXISTS 'Coordenadora de Leads';

-- Inserir departamento "Coordenadora de Leads" para todas as empresas que já têm departamentos
-- (será criado manualmente pelo usuário via interface, não precisa inserir automaticamente)
