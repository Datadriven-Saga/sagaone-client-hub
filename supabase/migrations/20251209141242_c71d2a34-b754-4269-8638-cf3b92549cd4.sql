-- Add 'Venda' to status_lead enum
ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'Venda' AFTER 'Check-in';