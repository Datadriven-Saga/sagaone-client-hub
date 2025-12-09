-- Add new columns to produtos table for photos, description and technical specifications
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS foto_principal_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ficha_tecnica TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_produtos_empresa_ativo ON public.produtos(empresa_id, ativo);

COMMENT ON COLUMN public.produtos.fotos IS 'Array of photo URLs (up to 10)';
COMMENT ON COLUMN public.produtos.foto_principal_index IS 'Index of the main photo in the fotos array';
COMMENT ON COLUMN public.produtos.ficha_tecnica IS 'Technical specifications of the product';