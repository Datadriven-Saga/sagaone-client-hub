-- Drop the broken trigger that references non-existent 'updated_at' column
DROP TRIGGER IF EXISTS update_eventos_pri_voz_updated_at ON public.eventos_pri_voz;

-- Create a correct trigger that uses 'atualizado_em'
CREATE OR REPLACE FUNCTION public.update_atualizado_em_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_eventos_pri_voz_atualizado_em
BEFORE UPDATE ON public.eventos_pri_voz
FOR EACH ROW
EXECUTE FUNCTION update_atualizado_em_column();