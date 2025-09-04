-- Criar políticas para o bucket agent-photos (ignorar se já existirem)

-- Política para visualização pública das fotos dos agentes
CREATE POLICY IF NOT EXISTS "Agent photos are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'agent-photos');

-- Política para upload apenas para usuários autenticados TI/Admin
CREATE POLICY IF NOT EXISTS "Users can upload agent photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);

-- Política para atualização apenas para usuários autenticados TI/Admin
CREATE POLICY IF NOT EXISTS "Users can update agent photos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);

-- Política para exclusão apenas para usuários autenticados TI/Admin
CREATE POLICY IF NOT EXISTS "Users can delete agent photos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'agent-photos' 
  AND auth.uid() IS NOT NULL
  AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
);