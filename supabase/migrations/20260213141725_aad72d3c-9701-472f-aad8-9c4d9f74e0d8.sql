
-- =============================================
-- 1. Create avatars bucket for profile photos
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 2. RLS policies for avatars bucket
-- =============================================

-- Public read access (bucket is public)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- 3. RLS policies for agent-photos bucket
-- =============================================

-- Public read
CREATE POLICY "Agent photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-photos');

-- Authenticated upload
CREATE POLICY "Authenticated users can upload agent photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-photos'
  AND auth.uid() IS NOT NULL
);

-- Authenticated update
CREATE POLICY "Authenticated users can update agent photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agent-photos'
  AND auth.uid() IS NOT NULL
);

-- Authenticated delete
CREATE POLICY "Authenticated users can delete agent photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-photos'
  AND auth.uid() IS NOT NULL
);

-- =============================================
-- 4. RLS policies for documentos-configuracao bucket
-- =============================================

-- Public read
CREATE POLICY "Documentos configuracao are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'documentos-configuracao');

-- Authenticated upload
CREATE POLICY "Authenticated users can upload documentos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documentos-configuracao'
  AND auth.uid() IS NOT NULL
);

-- Authenticated update
CREATE POLICY "Authenticated users can update documentos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documentos-configuracao'
  AND auth.uid() IS NOT NULL
);

-- Authenticated delete
CREATE POLICY "Authenticated users can delete documentos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documentos-configuracao'
  AND auth.uid() IS NOT NULL
);

-- =============================================
-- 5. RLS policies for whatsapp-templates bucket
-- =============================================

-- Public read
CREATE POLICY "WhatsApp templates are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-templates');

-- Authenticated upload
CREATE POLICY "Authenticated users can upload whatsapp templates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'whatsapp-templates'
  AND auth.uid() IS NOT NULL
);

-- Authenticated update
CREATE POLICY "Authenticated users can update whatsapp templates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'whatsapp-templates'
  AND auth.uid() IS NOT NULL
);

-- Authenticated delete
CREATE POLICY "Authenticated users can delete whatsapp templates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'whatsapp-templates'
  AND auth.uid() IS NOT NULL
);

-- =============================================
-- 6. RLS policies for convites-prospeccao bucket
-- =============================================

-- Public read
CREATE POLICY "Convites prospeccao are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'convites-prospeccao');

-- Authenticated upload
CREATE POLICY "Authenticated users can upload convites"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'convites-prospeccao'
  AND auth.uid() IS NOT NULL
);

-- Authenticated update
CREATE POLICY "Authenticated users can update convites"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'convites-prospeccao'
  AND auth.uid() IS NOT NULL
);

-- Authenticated delete
CREATE POLICY "Authenticated users can delete convites"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'convites-prospeccao'
  AND auth.uid() IS NOT NULL
);
