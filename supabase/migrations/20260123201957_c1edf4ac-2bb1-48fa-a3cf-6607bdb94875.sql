-- Corrige trigger inválido que tenta atualizar coluna inexistente (updated_at) na tabela cadencia_pri_voz
DROP TRIGGER IF EXISTS update_cadencia_pri_voz_updated_at ON public.cadencia_pri_voz;

-- Mantém atualizado_em preenchido quando não vier no payload (sem sobrescrever quando o sync envia valor)
CREATE OR REPLACE FUNCTION public.set_atualizado_em_if_null()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.atualizado_em IS NULL THEN
    NEW.atualizado_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_cadencia_pri_voz_atualizado_em ON public.cadencia_pri_voz;
CREATE TRIGGER set_cadencia_pri_voz_atualizado_em
BEFORE INSERT OR UPDATE ON public.cadencia_pri_voz
FOR EACH ROW
EXECUTE FUNCTION public.set_atualizado_em_if_null();