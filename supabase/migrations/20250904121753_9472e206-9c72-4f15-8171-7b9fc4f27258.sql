-- Criar bucket para fotos dos agentes de IA
INSERT INTO storage.buckets (id, name, public) 
VALUES ('agent-photos', 'agent-photos', true);

-- Política para permitir visualização pública das fotos dos agentes
CREATE POLICY "Agent photos are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'agent-photos');

-- Política para permitir upload apenas para usuários autenticados da mesma empresa
CREATE POLICY "Users can upload agent photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);

-- Política para permitir atualização apenas para usuários autenticados da mesma empresa
CREATE POLICY "Users can update agent photos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);

-- Política para permitir exclusão apenas para usuários autenticados da mesma empresa
CREATE POLICY "Users can delete agent photos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);