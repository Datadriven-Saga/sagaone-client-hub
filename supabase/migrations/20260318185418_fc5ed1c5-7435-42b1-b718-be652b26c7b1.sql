-- Fix 1: logs_notificacoes_email INSERT policy - restrict to service_role only
DROP POLICY IF EXISTS "Service pode inserir logs" ON public.logs_notificacoes_email;

CREATE POLICY "Service role pode inserir logs"
ON public.logs_notificacoes_email
FOR INSERT
TO service_role
WITH CHECK (true);

-- Fix 2: Make sensitive storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('documentos-configuracao', 'whatsapp-templates');