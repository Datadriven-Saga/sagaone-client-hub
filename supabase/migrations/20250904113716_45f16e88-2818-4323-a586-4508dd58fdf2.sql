-- Verificar se o trigger precisa ser atualizado para não sobrescrever empresa_id já definido
CREATE OR REPLACE FUNCTION public.set_empresa_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se empresa_id não foi definido, pegar da empresa ativa do usuário
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := get_user_active_company(auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe para contatos 
DROP TRIGGER IF EXISTS trigger_set_empresa_id_contatos ON public.contatos;
CREATE TRIGGER trigger_set_empresa_id_contatos
  BEFORE INSERT ON public.contatos
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

-- Garantir que o trigger existe para clientes 
DROP TRIGGER IF EXISTS trigger_set_empresa_id_clientes ON public.clientes;
CREATE TRIGGER trigger_set_empresa_id_clientes
  BEFORE INSERT ON public.clientes
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

-- Atualizar função sync_contato_to_cliente para garantir sincronização
CREATE OR REPLACE FUNCTION public.sync_contato_to_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_cliente_id UUID;
BEGIN
  -- Verificar se já existe um cliente com o mesmo nome e telefone na mesma empresa
  SELECT id INTO existing_cliente_id
  FROM public.clientes
  WHERE nome = NEW.nome 
    AND telefone = NEW.telefone 
    AND empresa_id = NEW.empresa_id
  LIMIT 1;

  -- Se não existe, criar um novo cliente
  IF existing_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      nome,
      telefone,
      email,
      empresa_id,
      user_id,
      observacoes,
      created_at,
      updated_at
    )
    VALUES (
      NEW.nome,
      NEW.telefone,
      NEW.email,
      NEW.empresa_id,
      auth.uid(),
      COALESCE(NEW.observacoes, 'Cliente criado automaticamente via prospecção'),
      NOW(),
      NOW()
    )
    RETURNING id INTO existing_cliente_id;
  END IF;

  -- Atualizar o contato com o cliente_id
  NEW.cliente_id = existing_cliente_id;
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger de sincronização existe
DROP TRIGGER IF EXISTS trigger_sync_contato_to_cliente ON public.contatos;
CREATE TRIGGER trigger_sync_contato_to_cliente
  BEFORE INSERT OR UPDATE ON public.contatos
  FOR EACH ROW 
  EXECUTE FUNCTION public.sync_contato_to_cliente();