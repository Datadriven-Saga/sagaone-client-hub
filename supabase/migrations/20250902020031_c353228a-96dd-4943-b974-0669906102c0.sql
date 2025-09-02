-- Habilitar proteção contra vazamento de senhas
ALTER ROLE authenticator SET password_encryption = 'scram-sha-256';

-- Adicionar políticas RLS para a tabela tipos_notificacao que estava sem políticas
-- Como é uma tabela de tipos/configurações, vamos permitir leitura para todos os usuários autenticados
CREATE POLICY "Usuários autenticados podem ver tipos de notificação" 
ON public.tipos_notificacao 
FOR SELECT 
TO authenticated
USING (true);

-- Apenas administradores podem gerenciar tipos de notificação
CREATE POLICY "Administradores podem gerenciar tipos de notificação" 
ON public.tipos_notificacao 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());