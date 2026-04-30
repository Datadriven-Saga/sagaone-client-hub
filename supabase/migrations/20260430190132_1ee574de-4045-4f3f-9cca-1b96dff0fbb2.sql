ALTER TABLE public.contato_quarentena
  ADD COLUMN IF NOT EXISTS expira_em timestamptz;

CREATE OR REPLACE FUNCTION public.set_quarentena_expira_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_fim_evento IS NULL THEN
    NEW.expira_em := NULL;
  ELSE
    NEW.expira_em := NEW.data_fim_evento + (CASE WHEN NEW.canal = 'whatsapp' THEN 20 ELSE 30 END) * interval '1 day';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_quarentena_expira_em ON public.contato_quarentena;
CREATE TRIGGER trg_set_quarentena_expira_em
  BEFORE INSERT OR UPDATE OF data_fim_evento, canal ON public.contato_quarentena
  FOR EACH ROW EXECUTE FUNCTION public.set_quarentena_expira_em();