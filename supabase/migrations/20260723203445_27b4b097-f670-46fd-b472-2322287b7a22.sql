REVOKE EXECUTE ON FUNCTION public.normalize_lead_status_label(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_lead_status_label(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.normalize_lead_status_label(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_lead_status_label(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_diagnostico_status_filtros() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_diagnostico_status_filtros() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_diagnostico_status_filtros() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_diagnostico_status_filtros() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) TO service_role;