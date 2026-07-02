
-- 1. Tabela de auditoria de rejeições/normalizações
CREATE TABLE public.contatos_responsavel_rejeicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NULL,
  responsavel_email_tentado text NOT NULL,
  operacao text NOT NULL CHECK (operacao IN ('INSERT','UPDATE')),
  modo text NOT NULL CHECK (modo IN ('strict','tolerant')),
  origem_db_user text NULL,
  origem_app_name text NULL,
  payload_resumo jsonb NULL,
  stack_context text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contatos_responsavel_rejeicoes TO authenticated;
GRANT ALL ON public.contatos_responsavel_rejeicoes TO service_role;

ALTER TABLE public.contatos_responsavel_rejeicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/TI/Master leem rejeições de responsável"
ON public.contatos_responsavel_rejeicoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tipo_acesso IN ('Administrador','TI','Master')
  )
);

CREATE INDEX idx_contatos_resp_rejeicoes_created
  ON public.contatos_responsavel_rejeicoes (created_at DESC);
CREATE INDEX idx_contatos_resp_rejeicoes_email
  ON public.contatos_responsavel_rejeicoes (responsavel_email_tentado);

-- 2. Função de validação
CREATE OR REPLACE FUNCTION public.validate_contato_responsavel_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_exists boolean;
  v_mode text;
  v_op text;
BEGIN
  IF NEW.responsavel_email IS NULL THEN
    RETURN NEW;
  END IF;

  v_email := lower(trim(NEW.responsavel_email));

  IF v_email = '' THEN
    NEW.responsavel_email := NULL;
    RETURN NEW;
  END IF;

  -- Se não mudou em UPDATE, não revalida (evita custo desnecessário)
  IF TG_OP = 'UPDATE'
     AND OLD.responsavel_email IS NOT NULL
     AND lower(trim(OLD.responsavel_email)) = v_email THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email
  ) INTO v_exists;

  IF v_exists THEN
    NEW.responsavel_email := v_email;
    RETURN NEW;
  END IF;

  -- Email inválido → decide modo
  v_mode := coalesce(
    nullif(current_setting('app.responsavel_strict', true), ''),
    'tolerant'
  );
  IF v_mode NOT IN ('strict','tolerant','on','off') THEN
    v_mode := 'tolerant';
  END IF;
  IF v_mode = 'on' THEN v_mode := 'strict'; END IF;
  IF v_mode = 'off' THEN v_mode := 'tolerant'; END IF;

  v_op := TG_OP;

  BEGIN
    INSERT INTO public.contatos_responsavel_rejeicoes (
      contato_id,
      responsavel_email_tentado,
      operacao,
      modo,
      origem_db_user,
      origem_app_name,
      payload_resumo,
      stack_context
    ) VALUES (
      NEW.id,
      NEW.responsavel_email,
      v_op,
      v_mode,
      current_user,
      current_setting('application_name', true),
      jsonb_build_object(
        'telefone', NEW.telefone,
        'empresa_id', NEW.empresa_id,
        'nome', NEW.nome
      ),
      left(coalesce(current_query(), ''), 500)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Nunca deixa o log derrubar a operação
    NULL;
  END;

  IF v_mode = 'strict' THEN
    RAISE EXCEPTION
      'responsavel_email "%": usuário não existe em auth.users', NEW.responsavel_email
      USING ERRCODE = '23514',
            HINT = 'Use um e-mail válido do sistema ou deixe em branco para distribuir automaticamente.';
  END IF;

  -- Modo tolerante: normaliza para NULL e segue
  NEW.responsavel_email := NULL;
  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_validate_contato_responsavel ON public.contatos;
CREATE TRIGGER trg_validate_contato_responsavel
BEFORE INSERT OR UPDATE OF responsavel_email ON public.contatos
FOR EACH ROW
EXECUTE FUNCTION public.validate_contato_responsavel_email();
