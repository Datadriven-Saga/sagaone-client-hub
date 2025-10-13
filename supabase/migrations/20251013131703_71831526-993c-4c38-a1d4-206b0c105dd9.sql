-- Adicionar novos valores ao ENUM status_lead para suportar o fluxo completo do Kanban
ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'Atribuído';
ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'Convidado';
ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'Agendado';
ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'Confirmado';
ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'Check-in';
ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'Descartado';
ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'Desperdício';