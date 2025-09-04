-- Verificar se o bucket já existe e criar políticas se necessário
DO $$ 
BEGIN
  -- Tentar criar as políticas (elas só serão criadas se não existirem)
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE name = 'Agent photos are publicly viewable' 
    AND bucket_id = 'agent-photos'
  ) THEN
    CREATE POLICY "Agent photos are publicly viewable" 
    ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'agent-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE name = 'Users can upload agent photos' 
    AND bucket_id = 'agent-photos'
  ) THEN
    CREATE POLICY "Users can upload agent photos" 
    ON storage.objects 
    FOR INSERT 
    WITH CHECK (
      bucket_id = 'agent-photos' 
      AND auth.uid() IS NOT NULL
      AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE name = 'Users can update agent photos' 
    AND bucket_id = 'agent-photos'
  ) THEN
    CREATE POLICY "Users can update agent photos" 
    ON storage.objects 
    FOR UPDATE 
    USING (
      bucket_id = 'agent-photos' 
      AND auth.uid() IS NOT NULL
      AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE name = 'Users can delete agent photos' 
    AND bucket_id = 'agent-photos'
  ) THEN
    CREATE POLICY "Users can delete agent photos" 
    ON storage.objects 
    FOR DELETE 
    USING (
      bucket_id = 'agent-photos' 
      AND auth.uid() IS NOT NULL
      AND (get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
    );
  END IF;
END $$;