-- Atualizar o crm_id da empresa SN DF PARK SUL (ID bfdfd0f0-2661-4a2d-a2ba-03295fa1cab3) para 18404
UPDATE empresas 
SET crm_id = '18404', updated_at = now()
WHERE id = 'bfdfd0f0-2661-4a2d-a2ba-03295fa1cab3';