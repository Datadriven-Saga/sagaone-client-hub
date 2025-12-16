-- Create storage bucket for WhatsApp templates media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp-templates', 'whatsapp-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the bucket
CREATE POLICY "Authenticated users can upload template media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-templates');

CREATE POLICY "Anyone can view template media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-templates');

CREATE POLICY "Authenticated users can update template media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-templates');

CREATE POLICY "Authenticated users can delete template media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-templates');