-- Drop the existing constraint
ALTER TABLE public.prospeccoes DROP CONSTRAINT prospeccoes_canal_check;

-- Add the updated constraint with new allowed values
ALTER TABLE public.prospeccoes ADD CONSTRAINT prospeccoes_canal_check 
CHECK (canal = ANY (ARRAY['Whatsapp'::text, 'Ligação'::text, 'Grande Evento'::text, 'Mensal'::text]));