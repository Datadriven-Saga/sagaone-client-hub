-- Função para sincronizar contato com cliente
CREATE OR REPLACE FUNCTION public.sync_contato_to_cliente()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para novos contatos
CREATE TRIGGER trigger_sync_contato_to_cliente
  BEFORE INSERT ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contato_to_cliente();

-- Sincronizar dados históricos (contatos existentes que não têm cliente correspondente)
DO $$
DECLARE
  contato_record RECORD;
  existing_cliente_id UUID;
  new_cliente_id UUID;
BEGIN
  -- Percorrer todos os contatos que não têm cliente_id definido
  FOR contato_record IN 
    SELECT id, nome, telefone, email, empresa_id, observacoes, created_at
    FROM public.contatos 
    WHERE cliente_id IS NULL 
      AND empresa_id IS NOT NULL
  LOOP
    -- Verificar se já existe um cliente com o mesmo nome e telefone na mesma empresa
    SELECT id INTO existing_cliente_id
    FROM public.clientes
    WHERE nome = contato_record.nome 
      AND telefone = contato_record.telefone 
      AND empresa_id = contato_record.empresa_id
    LIMIT 1;

    IF existing_cliente_id IS NOT NULL THEN
      -- Se já existe, apenas vincular
      new_cliente_id := existing_cliente_id;
    ELSE
      -- Se não existe, criar um novo cliente
      INSERT INTO public.clientes (
        nome,
        telefone,
        email,
        empresa_id,
        observacoes,
        created_at,
        updated_at
      )
      VALUES (
        contato_record.nome,
        contato_record.telefone,
        contato_record.email,
        contato_record.empresa_id,
        COALESCE(contato_record.observacoes, 'Cliente migrado automaticamente de contatos existentes'),
        contato_record.created_at,
        NOW()
      )
      RETURNING id INTO new_cliente_id;
    END IF;

    -- Atualizar o contato com o cliente_id
    UPDATE public.contatos 
    SET cliente_id = new_cliente_id, updated_at = NOW()
    WHERE id = contato_record.id;
    
  END LOOP;
  
  RAISE NOTICE 'Sincronização de dados históricos concluída';
END $$;