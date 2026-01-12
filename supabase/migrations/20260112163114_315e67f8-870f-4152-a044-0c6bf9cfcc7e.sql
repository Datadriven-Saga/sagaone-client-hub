
-- Passo 1: Identificar os IDs dos agentes que serão mantidos (mais recentes por telefone)
-- e deletar as dependências dos duplicados

-- Para cada telefone duplicado, manter apenas o agente com created_at mais recente
-- Deletar todos os registros relacionados aos agentes que serão removidos

-- Telefone 6520181190 - IDs para deletar (todos exceto o mais recente)
DELETE FROM agente_cadencias WHERE agente_id IN (
  '58343ab8-202f-4c61-917c-15f2dcf95107', 
  'aab0ebc5-87ad-4ceb-b2d0-91b0b189cb46', 
  '71a22f57-caf3-4f5e-b871-630bdf4a07d8', 
  'e0425028-64c7-44f7-ba65-6a5b174469e9', 
  '30e8d0e1-5ee0-455a-8ca7-0e98293d7e14'
);

DELETE FROM agente_cadencias_steps WHERE agente_id IN (
  '58343ab8-202f-4c61-917c-15f2dcf95107', 
  'aab0ebc5-87ad-4ceb-b2d0-91b0b189cb46', 
  '71a22f57-caf3-4f5e-b871-630bdf4a07d8', 
  'e0425028-64c7-44f7-ba65-6a5b174469e9', 
  '30e8d0e1-5ee0-455a-8ca7-0e98293d7e14'
);

DELETE FROM agente_followups WHERE agente_id IN (
  '58343ab8-202f-4c61-917c-15f2dcf95107', 
  'aab0ebc5-87ad-4ceb-b2d0-91b0b189cb46', 
  '71a22f57-caf3-4f5e-b871-630bdf4a07d8', 
  'e0425028-64c7-44f7-ba65-6a5b174469e9', 
  '30e8d0e1-5ee0-455a-8ca7-0e98293d7e14'
);

DELETE FROM agente_integracoes WHERE agente_id IN (
  '58343ab8-202f-4c61-917c-15f2dcf95107', 
  'aab0ebc5-87ad-4ceb-b2d0-91b0b189cb46', 
  '71a22f57-caf3-4f5e-b871-630bdf4a07d8', 
  'e0425028-64c7-44f7-ba65-6a5b174469e9', 
  '30e8d0e1-5ee0-455a-8ca7-0e98293d7e14'
);

DELETE FROM agente_variaveis WHERE agente_id IN (
  '58343ab8-202f-4c61-917c-15f2dcf95107', 
  'aab0ebc5-87ad-4ceb-b2d0-91b0b189cb46', 
  '71a22f57-caf3-4f5e-b871-630bdf4a07d8', 
  'e0425028-64c7-44f7-ba65-6a5b174469e9', 
  '30e8d0e1-5ee0-455a-8ca7-0e98293d7e14'
);

DELETE FROM agente_performance WHERE agente_id IN (
  '58343ab8-202f-4c61-917c-15f2dcf95107', 
  'aab0ebc5-87ad-4ceb-b2d0-91b0b189cb46', 
  '71a22f57-caf3-4f5e-b871-630bdf4a07d8', 
  'e0425028-64c7-44f7-ba65-6a5b174469e9', 
  '30e8d0e1-5ee0-455a-8ca7-0e98293d7e14'
);

DELETE FROM agente_empresas WHERE agente_id IN (
  '58343ab8-202f-4c61-917c-15f2dcf95107', 
  'aab0ebc5-87ad-4ceb-b2d0-91b0b189cb46', 
  '71a22f57-caf3-4f5e-b871-630bdf4a07d8', 
  'e0425028-64c7-44f7-ba65-6a5b174469e9', 
  '30e8d0e1-5ee0-455a-8ca7-0e98293d7e14'
);

-- Telefone 6223980043 - IDs para deletar (mantém dae6e3cc que é Agente GO)
DELETE FROM agente_cadencias WHERE agente_id IN (
  '097888f2-0f4a-4247-b152-e06bb8487dce', 
  '3bd3defa-ab3a-4f70-b33f-c35b6bc051ac', 
  '0963d88c-d267-4479-a00d-abe533781aa1', 
  'f2a4c131-bbff-47d2-9a70-a5600bcc3adf'
);

DELETE FROM agente_cadencias_steps WHERE agente_id IN (
  '097888f2-0f4a-4247-b152-e06bb8487dce', 
  '3bd3defa-ab3a-4f70-b33f-c35b6bc051ac', 
  '0963d88c-d267-4479-a00d-abe533781aa1', 
  'f2a4c131-bbff-47d2-9a70-a5600bcc3adf'
);

DELETE FROM agente_followups WHERE agente_id IN (
  '097888f2-0f4a-4247-b152-e06bb8487dce', 
  '3bd3defa-ab3a-4f70-b33f-c35b6bc051ac', 
  '0963d88c-d267-4479-a00d-abe533781aa1', 
  'f2a4c131-bbff-47d2-9a70-a5600bcc3adf'
);

DELETE FROM agente_integracoes WHERE agente_id IN (
  '097888f2-0f4a-4247-b152-e06bb8487dce', 
  '3bd3defa-ab3a-4f70-b33f-c35b6bc051ac', 
  '0963d88c-d267-4479-a00d-abe533781aa1', 
  'f2a4c131-bbff-47d2-9a70-a5600bcc3adf'
);

DELETE FROM agente_variaveis WHERE agente_id IN (
  '097888f2-0f4a-4247-b152-e06bb8487dce', 
  '3bd3defa-ab3a-4f70-b33f-c35b6bc051ac', 
  '0963d88c-d267-4479-a00d-abe533781aa1', 
  'f2a4c131-bbff-47d2-9a70-a5600bcc3adf'
);

DELETE FROM agente_performance WHERE agente_id IN (
  '097888f2-0f4a-4247-b152-e06bb8487dce', 
  '3bd3defa-ab3a-4f70-b33f-c35b6bc051ac', 
  '0963d88c-d267-4479-a00d-abe533781aa1', 
  'f2a4c131-bbff-47d2-9a70-a5600bcc3adf'
);

DELETE FROM agente_empresas WHERE agente_id IN (
  '097888f2-0f4a-4247-b152-e06bb8487dce', 
  '3bd3defa-ab3a-4f70-b33f-c35b6bc051ac', 
  '0963d88c-d267-4479-a00d-abe533781aa1', 
  'f2a4c131-bbff-47d2-9a70-a5600bcc3adf'
);

-- Agora deletar os agentes duplicados
DELETE FROM agentes_ia WHERE id IN (
  '58343ab8-202f-4c61-917c-15f2dcf95107', 
  'aab0ebc5-87ad-4ceb-b2d0-91b0b189cb46', 
  '71a22f57-caf3-4f5e-b871-630bdf4a07d8', 
  'e0425028-64c7-44f7-ba65-6a5b174469e9', 
  '30e8d0e1-5ee0-455a-8ca7-0e98293d7e14',
  '097888f2-0f4a-4247-b152-e06bb8487dce', 
  '3bd3defa-ab3a-4f70-b33f-c35b6bc051ac', 
  '0963d88c-d267-4479-a00d-abe533781aa1', 
  'f2a4c131-bbff-47d2-9a70-a5600bcc3adf'
);

-- Adicionar constraint UNIQUE no telefone para evitar duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS agentes_ia_telefone_unique 
ON agentes_ia (telefone) 
WHERE telefone IS NOT NULL AND telefone != '';
