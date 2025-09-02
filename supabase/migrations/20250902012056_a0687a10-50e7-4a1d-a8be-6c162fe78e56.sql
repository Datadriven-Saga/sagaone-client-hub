-- Corrigir os nomes dos usuários existentes que foram salvos como email
-- Para usuários administradores, usar nome padrão
UPDATE profiles 
SET nome_completo = 'Administrador'
WHERE tipo_acesso = 'Administrador' 
AND nome_completo LIKE '%@%';

-- Para usuários TI, usar nome padrão  
UPDATE profiles 
SET nome_completo = 'Usuário TI'
WHERE tipo_acesso = 'TI' 
AND nome_completo LIKE '%@%';