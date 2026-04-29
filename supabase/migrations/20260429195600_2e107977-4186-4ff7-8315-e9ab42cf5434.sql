ALTER TABLE public.pool_clientes_externos
  ADD COLUMN IF NOT EXISTS status_crm TEXT;