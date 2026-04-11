DO $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at)
  VALUES (v_id, '00000000-0000-0000-0000-000000000000', 'pri.ia@sagadatadriven.com.br', '', now(), 'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, nome_completo, tipo_acesso)
  VALUES (v_id, 'Pri IA', 'Sistema')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Pri IA user created with ID: %', v_id;
END $$;