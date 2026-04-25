UPDATE public.system_feature_flags
SET 
  flag_label = 'Sincronização de Leads no MobiGestor',
  description = 'Sincroniza leads com o MobiGestor a partir das movimentações no Kanban: cria o lead na loja quando movido para Confirmado ou Check-in, e cria + desqualifica na central quando movido para Descartado. Aplicável apenas a eventos de prospecção humana (Mensal e Grande Evento).',
  updated_at = now()
WHERE flag_key = 'webhook_movimentacao_lead';