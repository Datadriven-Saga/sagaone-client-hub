DROP FUNCTION IF EXISTS public.export_evento_base(uuid, uuid, text, text, text, uuid, integer);

GRANT EXECUTE ON FUNCTION public.export_evento_base(uuid, uuid, uuid, integer, text, text, text) TO authenticated;