-- Reverter o crm_id da empresa SN DF PARK SUL para o valor original 18421
UPDATE empresas 
SET crm_id = '18421', updated_at = now()
WHERE id = 'bfdfd0f0-2661-4a2d-a2ba-03295fa1cab3';