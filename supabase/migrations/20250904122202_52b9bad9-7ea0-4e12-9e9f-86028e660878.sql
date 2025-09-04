-- Remover políticas existentes (se existirem) e criar novas
DROP POLICY IF EXISTS "Agent photos are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload agent photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update agent photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete agent photos" ON storage.objects;

-- Criar políticas para o bucket agent-photos
CREATE POLICY "Agent photos are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'agent-photos');

CREATE POLICY "Users can upload agent photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);

CREATE POLICY "Users can update agent photos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);

CREATE POLICY "Users can delete agent photos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);