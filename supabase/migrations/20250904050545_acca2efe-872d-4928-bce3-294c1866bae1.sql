-- CORRIGIR SECURITY WARNING: Function Search Path Mutable
-- Adicionar SET search_path = public em todas as funções para segurança

-- Corrigir audit_sensitive_data_access
CREATE OR REPLACE FUNCTION audit_sensitive_data_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log de auditoria apenas para SELECT em dados sensíveis
  IF TG_OP = 'SELECT' AND TG_TABLE_NAME IN ('clientes', 'contatos') THEN
    INSERT INTO public.logs_movimentacao_contatos (
      contato_id,
      status_anterior,
      status_novo, 
      observacoes,
      usuario_id,
      prospeccao_id,
      created_at
    ) VALUES (
      COALESCE(NEW.id, OLD.id, gen_random_uuid()),
      'audit',
      'data_access',
      'Acesso a dados sensíveis: ' || TG_TABLE_NAME || ' por usuário ' || auth.uid()::text,
      auth.uid(),
      (SELECT id FROM prospeccoes LIMIT 1), -- Placeholder
      NOW()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Corrigir update_updated_at_column 
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Corrigir mask_sensitive_data para usar search_path correto
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(data_type text, value text, user_type tipo_acesso)
RETURNS text
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas admins veem dados completos
  IF user_type = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]) THEN
    RETURN value;
  END IF;
  
  -- Mascarar dados sensíveis para outros usuários
  CASE data_type
    WHEN 'cpf' THEN RETURN REGEXP_REPLACE(COALESCE(value, ''), '(\d{3})\d{6}(\d{2})', '\1****\2');
    WHEN 'telefone' THEN RETURN REGEXP_REPLACE(COALESCE(value, ''), '(\d{2})(\d{5})\d{4}', '\1\2****');  
    WHEN 'email' THEN RETURN REGEXP_REPLACE(COALESCE(value, ''), '(.{2}).+(@.+)', '\1****\2');
    ELSE RETURN '****';
  END CASE;
END;
$$;