-- Adicionar política de leitura para Gerentes na tabela agentes_ia
-- Isso permite que Gerentes de Leads e Gerentes de Loja vejam os agentes da empresa para usar em templates

CREATE POLICY "agentes_ia_gerentes_read_access" ON public.agentes_ia
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_access_type() = ANY (ARRAY['Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  );