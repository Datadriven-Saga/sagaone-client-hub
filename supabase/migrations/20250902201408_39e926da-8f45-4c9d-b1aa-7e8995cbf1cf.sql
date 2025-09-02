-- Add canal field to prospeccoes table
ALTER TABLE public.prospeccoes ADD COLUMN canal TEXT NOT NULL DEFAULT 'Whatsapp' CHECK (canal IN ('Whatsapp', 'Ligação'));