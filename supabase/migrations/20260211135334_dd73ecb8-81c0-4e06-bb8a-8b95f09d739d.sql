-- Insert master user
INSERT INTO public.mfa_master_users (user_id) VALUES ('240d8c4e-f7d2-4201-87b5-7e7873dbd218')
ON CONFLICT DO NOTHING;

-- Insert default feature flags
INSERT INTO public.mfa_feature_flags (flag_key, flag_label, enabled) VALUES
  ('mfa_creation', 'Criação de Authenticators', true),
  ('mfa_viewing', 'Visualização de Códigos', true),
  ('mfa_access_assignment', 'Atribuição de Acesso', true),
  ('mfa_logs_viewing', 'Visualização de Logs', true)
ON CONFLICT (flag_key) DO NOTHING;