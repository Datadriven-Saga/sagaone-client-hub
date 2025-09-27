-- Fix security warnings by setting search_path for functions

-- Update normalize_phone_e164 function with search_path
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
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

-- Update generate_optout_dedupe_key function with search_path
CREATE OR REPLACE FUNCTION public.generate_optout_dedupe_key(
    telefone TEXT DEFAULT NULL,
    email TEXT DEFAULT NULL,
    canal_param canal_optout DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
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

-- Update handle_optout_before_insert_update function with search_path
CREATE OR REPLACE FUNCTION public.handle_optout_before_insert_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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