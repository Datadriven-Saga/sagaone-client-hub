
-- Tabela para cofre de senhas vinculadas a contas MFA
CREATE TABLE public.mfa_password_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  login TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_password_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_password_vault FORCE ROW LEVEL SECURITY;

-- RLS: apenas MFA Masters podem gerenciar
CREATE POLICY "MFA masters can view vault"
  ON public.mfa_password_vault FOR SELECT TO authenticated
  USING (public.is_mfa_master(auth.uid()));

CREATE POLICY "MFA masters can insert vault"
  ON public.mfa_password_vault FOR INSERT TO authenticated
  WITH CHECK (public.is_mfa_master(auth.uid()));

CREATE POLICY "MFA masters can update vault"
  ON public.mfa_password_vault FOR UPDATE TO authenticated
  USING (public.is_mfa_master(auth.uid()));

CREATE POLICY "MFA masters can delete vault"
  ON public.mfa_password_vault FOR DELETE TO authenticated
  USING (public.is_mfa_master(auth.uid()));

-- Trigger para criptografar a senha automaticamente (reutiliza mesma chave AES do MFA)
CREATE OR REPLACE FUNCTION public.encrypt_vault_password_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public, extensions' AS $$
DECLARE enc_key bytea;
  test_decrypt text;
BEGIN
  -- Tenta descriptografar para ver se já está encriptado
  BEGIN
    enc_key := extensions.digest('mfa_totp_encryption_saga_one_2025_secure_key', 'sha256');
    test_decrypt := convert_from(extensions.decrypt(decode(NEW.password_encrypted, 'base64'), enc_key, 'aes'), 'utf8');
    -- Já encriptado, não faz nada
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    -- Não encriptado, encripta agora
    NEW.password_encrypted := public.encrypt_mfa_secret(NEW.password_encrypted);
    RETURN NEW;
  END;
END;
$$;

CREATE TRIGGER encrypt_vault_password
  BEFORE INSERT OR UPDATE ON public.mfa_password_vault
  FOR EACH ROW EXECUTE FUNCTION encrypt_vault_password_trigger();

-- View para leitura com senha descriptografada
CREATE VIEW public.mfa_password_vault_decrypted
WITH (security_invoker = true) AS
SELECT
  v.id, v.account_id, v.login,
  public.decrypt_mfa_secret(v.password_encrypted) AS password_plain,
  v.notes, v.created_by, v.created_at, v.updated_at
FROM public.mfa_password_vault v
WHERE public.is_mfa_master(auth.uid());

-- Índice para busca por account_id
CREATE INDEX idx_mfa_password_vault_account ON public.mfa_password_vault(account_id);
