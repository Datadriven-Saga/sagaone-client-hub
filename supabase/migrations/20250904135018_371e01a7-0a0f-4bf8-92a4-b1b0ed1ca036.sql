-- Corrigir problema do multi-empresa: criar profile e associações necessárias

DO $$
DECLARE
  current_user_id UUID;
  primeira_empresa_id UUID;
  profile_exists BOOLEAN;
BEGIN
  -- Obter o ID do usuário atual
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  RAISE NOTICE 'Processando usuário: %', current_user_id;
  
  -- Verificar se o profile existe
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = current_user_id
  ) INTO profile_exists;
  
  -- Se não existe profile, criar
  IF NOT profile_exists THEN
    INSERT INTO public.profiles (
      id, 
      nome_completo, 
      tipo_acesso
    ) VALUES (
      current_user_id,
      'Administrador Sistema',
      'Administrador'::tipo_acesso
    );
    RAISE NOTICE 'Profile criado para usuário: %', current_user_id;
  END IF;
  
  -- Pegar a primeira empresa disponível
  SELECT id INTO primeira_empresa_id 
  FROM public.empresas 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  -- Se o usuário não tem associação com empresa, criar
  IF NOT EXISTS (
    SELECT 1 FROM public.user_empresas WHERE user_id = current_user_id
  ) THEN
    INSERT INTO public.user_empresas (
      user_id,
      empresa_id,
      is_ativa
    ) VALUES (
      current_user_id,
      primeira_empresa_id,
      TRUE
    );
    RAISE NOTICE 'Usuário % associado à empresa %', current_user_id, primeira_empresa_id;
  END IF;
  
  -- Verificar se existem outros usuários sem associação e criar profiles/associações para eles
  INSERT INTO public.profiles (id, nome_completo, tipo_acesso)
  SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Usuário Sistema'),
    'SDR'::tipo_acesso
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE p.id IS NULL;
  
  -- Associar usuários sem empresa à primeira empresa
  INSERT INTO public.user_empresas (user_id, empresa_id, is_ativa)
  SELECT DISTINCT 
    au.id,
    primeira_empresa_id,
    FALSE
  FROM auth.users au
  LEFT JOIN public.user_empresas ue ON au.id = ue.user_id
  WHERE ue.user_id IS NULL;
  
  RAISE NOTICE 'Processo de correção multi-empresa concluído.';
  
END $$;