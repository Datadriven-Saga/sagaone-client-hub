-- Corrigir problema de multi-empresa: associar usuários existentes a empresas

-- Primeiro, verificar se existe pelo menos uma empresa
DO $$
DECLARE
  empresa_count INTEGER;
  primeira_empresa_id UUID;
  usuario_record RECORD;
BEGIN
  -- Contar empresas existentes
  SELECT COUNT(*) INTO empresa_count FROM public.empresas;
  
  -- Se não há empresas, criar uma empresa padrão
  IF empresa_count = 0 THEN
    INSERT INTO public.empresas (
      nome_empresa, 
      razao_social, 
      cnpj
    ) VALUES (
      'Empresa Padrão TAVAT',
      'Empresa Padrão TAVAT LTDA',
      '00.000.000/0001-00'
    ) RETURNING id INTO primeira_empresa_id;
    
    RAISE NOTICE 'Empresa padrão criada com ID: %', primeira_empresa_id;
  ELSE
    -- Pegar a primeira empresa existente
    SELECT id INTO primeira_empresa_id 
    FROM public.empresas 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    RAISE NOTICE 'Usando empresa existente com ID: %', primeira_empresa_id;
  END IF;
  
  -- Associar todos os usuários que não têm empresa à primeira empresa
  FOR usuario_record IN 
    SELECT DISTINCT p.id as user_id
    FROM public.profiles p
    LEFT JOIN public.user_empresas ue ON p.id = ue.user_id
    WHERE ue.user_id IS NULL
  LOOP
    -- Inserir associação do usuário com a empresa
    INSERT INTO public.user_empresas (
      user_id,
      empresa_id,
      is_ativa
    ) VALUES (
      usuario_record.user_id,
      primeira_empresa_id,
      TRUE
    );
    
    RAISE NOTICE 'Usuário % associado à empresa %', usuario_record.user_id, primeira_empresa_id;
  END LOOP;
  
  RAISE NOTICE 'Processo de associação multi-empresa concluído.';
END $$;