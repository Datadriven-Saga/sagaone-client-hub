-- Adicionar tipo de acesso 'Proprietário' ao enum tipo_acesso
ALTER TYPE public.tipo_acesso ADD VALUE IF NOT EXISTS 'Proprietário';