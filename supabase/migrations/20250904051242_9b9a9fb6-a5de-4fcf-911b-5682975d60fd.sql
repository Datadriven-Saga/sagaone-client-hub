-- CRIAR TRIGGER PARA SETAR empresa_id AUTOMATICAMENTE
-- Garantir que contatos sempre tenham empresa_id preenchido

CREATE OR REPLACE FUNCTION set_empresa_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Se empresa_id não foi definido, pegar da empresa ativa do usuário
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := get_user_active_company(auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para contatos
DROP TRIGGER IF EXISTS trigger_set_empresa_id_contatos ON public.contatos;
CREATE TRIGGER trigger_set_empresa_id_contatos
  BEFORE INSERT ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION set_empresa_id_on_insert();

-- Criar trigger para clientes também
DROP TRIGGER IF EXISTS trigger_set_empresa_id_clientes ON public.clientes;
CREATE TRIGGER trigger_set_empresa_id_clientes
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION set_empresa_id_on_insert();