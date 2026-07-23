DO $$
DECLARE
  fk_defs TEXT[][] := ARRAY[
    ['allowed_login_domains','allowed_login_domains_criado_por_fkey','criado_por'],
    ['clientes','clientes_user_id_fkey','user_id'],
    ['eventos_prospeccao','eventos_prospeccao_usuario_id_fkey','usuario_id'],
    ['external_access_seats','external_access_seats_created_by_fkey','created_by'],
    ['external_seat_limits','external_seat_limits_updated_by_fkey','updated_by'],
    ['gatilhos','gatilhos_criado_por_fkey','criado_por'],
    ['logs_cadeiras','logs_cadeiras_executado_por_fkey','executado_por'],
    ['logs_cadeiras','logs_cadeiras_profile_id_fkey','profile_id'],
    ['notificacoes','notificacoes_destinatario_id_fkey','destinatario_id'],
    ['notificacoes','notificacoes_remetente_id_fkey','remetente_id'],
    ['participacoes_treinamento','participacoes_treinamento_participante_id_fkey','participante_id'],
    ['personas','personas_criado_por_fkey','criado_por'],
    ['profiles','profiles_external_created_by_fkey','external_created_by'],
    ['profiles','profiles_gestor_imediato_fkey','gestor_imediato'],
    ['prospeccoes','prospeccoes_responsavel_id_fkey','responsavel_id'],
    ['relatorios','relatorios_gerado_por_fkey','gerado_por'],
    ['treinamentos','treinamentos_instrutor_id_fkey','instrutor_id'],
    ['vendas_prospeccao','vendas_prospeccao_responsavel_id_fkey','responsavel_id'],
    ['whatsapp_vinculados','whatsapp_vinculados_usuario_id_fkey','usuario_id']
  ];
  i INT;
BEGIN
  FOR i IN 1..array_length(fk_defs,1) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', fk_defs[i][1], fk_defs[i][2]);
  END LOOP;
END $$;

COMMENT ON TABLE public.deleted_users_archive IS 'Arquivo de identidade mínima de usuários excluídos para preservar histórico e resolver nomes após remoção do Auth.';