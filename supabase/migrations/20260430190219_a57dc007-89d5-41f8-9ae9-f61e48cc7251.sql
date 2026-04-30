-- Corrige search_path do gatilho (linter)
CREATE OR REPLACE FUNCTION public.set_quarentena_expira_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
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

-- Backfill (~495k linhas)
UPDATE public.contato_quarentena
SET expira_em = data_fim_evento + (CASE WHEN canal = 'whatsapp' THEN 20 ELSE 30 END) * interval '1 day'
WHERE data_fim_evento IS NOT NULL AND expira_em IS NULL;