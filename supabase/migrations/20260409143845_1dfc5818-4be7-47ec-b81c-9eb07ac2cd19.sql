-- Remove FORCE ROW LEVEL SECURITY to allow SECURITY DEFINER functions 
-- (like auto_atribuir_leads_vendedor) to bypass RLS properly.
-- Regular RLS remains enabled and enforced for normal user queries.
ALTER TABLE public.contatos NO FORCE ROW LEVEL SECURITY;