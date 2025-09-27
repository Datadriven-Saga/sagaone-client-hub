-- Create enum for opt-out channels
CREATE TYPE canal_optout AS ENUM ('Whatsapp', 'Ligação', 'SMS', 'E-mail');

-- Create opt_outs table
CREATE TABLE public.opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES auth.users(id),
    source TEXT NOT NULL DEFAULT 'UI', -- 'UI', 'API', 'IMPORT'
    data_optout TIMESTAMPTZ NOT NULL,
    nome TEXT,
    telefone_e164 TEXT,
    email_normalizado TEXT,
    canal canal_optout NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    dedupe_key TEXT NOT NULL,
    CONSTRAINT uq_optouts_dedupe UNIQUE (dedupe_key),
    CONSTRAINT chk_optouts_identificador CHECK (
        telefone_e164 IS NOT NULL OR email_normalizado IS NOT NULL
    )
);

-- Create indexes for performance
CREATE INDEX idx_optouts_telefone ON public.opt_outs(telefone_e164);
CREATE INDEX idx_optouts_email ON public.opt_outs(email_normalizado);
CREATE INDEX idx_optouts_canal ON public.opt_outs(canal);
CREATE INDEX idx_optouts_empresa ON public.opt_outs(empresa_id);
CREATE INDEX idx_optouts_data ON public.opt_outs(data_optout);

-- Enable RLS
ALTER TABLE public.opt_outs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "opt_outs_company_users" ON public.opt_outs
FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Function to normalize phone to E.164 format
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Remove all non-digits
    phone_input := REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g');
    
    -- Skip if less than 10 digits (Brazilian minimum)
    IF LENGTH(phone_input) < 10 THEN
        RETURN NULL;
    END IF;
    
    -- Add +55 if doesn't start with country code
    IF NOT phone_input ~ '^55' THEN
        phone_input := '55' || phone_input;
    END IF;
    
    -- Return with + prefix
    RETURN '+' || phone_input;
END;
$$;

-- Function to generate dedupe key
CREATE OR REPLACE FUNCTION public.generate_optout_dedupe_key(
    telefone TEXT DEFAULT NULL,
    email TEXT DEFAULT NULL,
    canal_param canal_optout DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    identificador TEXT;
BEGIN
    -- Use phone as priority, then email
    IF telefone IS NOT NULL THEN
        identificador := public.normalize_phone_e164(telefone);
    ELSIF email IS NOT NULL THEN
        identificador := LOWER(TRIM(email));
    ELSE
        RETURN NULL;
    END IF;
    
    -- Generate hash of identifier + channel
    RETURN MD5(identificador || '|' || canal_param::TEXT);
END;
$$;

-- Trigger function to auto-populate normalized fields and dedupe key
CREATE OR REPLACE FUNCTION public.handle_optout_before_insert_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Normalize phone
    IF NEW.telefone_e164 IS NOT NULL THEN
        NEW.telefone_e164 := public.normalize_phone_e164(NEW.telefone_e164);
    END IF;
    
    -- Normalize email
    IF NEW.email_normalizado IS NOT NULL THEN
        NEW.email_normalizado := LOWER(TRIM(NEW.email_normalizado));
    END IF;
    
    -- Generate dedupe key
    NEW.dedupe_key := public.generate_optout_dedupe_key(
        NEW.telefone_e164,
        NEW.email_normalizado,
        NEW.canal
    );
    
    -- Set updated_at and updated_by on updates
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();
    END IF;
    
    -- Set empresa_id from user's active company if not provided
    IF NEW.empresa_id IS NULL THEN
        NEW.empresa_id := get_user_active_company(auth.uid());
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trg_optout_before_insert_update
    BEFORE INSERT OR UPDATE ON public.opt_outs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_optout_before_insert_update();

-- Add "Controle Opt Out" module to Empresa Padrão
INSERT INTO public.empresa_modulos (
    empresa_id,
    modulo_nome,
    data_inicio,
    data_fim,
    ativo
) VALUES (
    '00000000-0000-0000-0000-000000000001', -- Empresa Padrão ID
    'Controle Opt Out',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '10 years', -- Valid for 10 years
    true
);