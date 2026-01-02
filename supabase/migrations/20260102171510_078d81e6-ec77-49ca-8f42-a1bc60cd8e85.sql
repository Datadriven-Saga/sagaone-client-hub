-- Atualizar templates existentes sem IDs da PRI e Meta para status INTEGRATION ERROR
UPDATE whatsapp_templates 
SET status_meta = 'INTEGRATION_ERROR', updated_at = now()
WHERE (template_id_pri IS NULL OR template_id_pri = '') 
  AND (id_meta IS NULL OR id_meta = '')