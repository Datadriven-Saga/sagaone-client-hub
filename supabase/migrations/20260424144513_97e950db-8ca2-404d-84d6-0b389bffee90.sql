INSERT INTO public.system_feature_flags (flag_key, flag_label, description, category, scope, is_enabled)
VALUES (
  'confirmacao_presenca_whatsapp',
  'Confirmação de Presença via WhatsApp',
  'Habilita o fluxo de envio de link de confirmação de presença ao mover lead para Convidados (modal no Kanban, landing pública /confirmar/:token e badges no ConviteTab).',
  'prospeccao',
  'per_empresa',
  false
)
ON CONFLICT (flag_key) DO NOTHING;