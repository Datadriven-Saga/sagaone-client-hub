
CREATE TABLE public.pos_vendas_gatilho_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  gatilho_slug TEXT NOT NULL,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agente_id, empresa_id, gatilho_slug)
);
CREATE INDEX idx_pvgc_agente_empresa ON public.pos_vendas_gatilho_config(agente_id, empresa_id);
ALTER TABLE public.pos_vendas_gatilho_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pvgc_select" ON public.pos_vendas_gatilho_config FOR SELECT USING (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvgc_insert" ON public.pos_vendas_gatilho_config FOR INSERT WITH CHECK (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvgc_update" ON public.pos_vendas_gatilho_config FOR UPDATE USING (public.user_can_access_empresa(empresa_id, auth.uid())) WITH CHECK (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvgc_delete" ON public.pos_vendas_gatilho_config FOR DELETE USING (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE TRIGGER trg_pvgc_updated_at BEFORE UPDATE ON public.pos_vendas_gatilho_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pos_vendas_cadencia_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  template_inicial_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  max_tentativas INT NOT NULL DEFAULT 3 CHECK (max_tentativas BETWEEN 1 AND 10),
  intervalo_tentativas_horas INT NOT NULL DEFAULT 24 CHECK (intervalo_tentativas_horas BETWEEN 1 AND 168),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agente_id, empresa_id)
);
CREATE INDEX idx_pvcc_agente_empresa ON public.pos_vendas_cadencia_config(agente_id, empresa_id);
ALTER TABLE public.pos_vendas_cadencia_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pvcc_select" ON public.pos_vendas_cadencia_config FOR SELECT USING (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvcc_insert" ON public.pos_vendas_cadencia_config FOR INSERT WITH CHECK (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvcc_update" ON public.pos_vendas_cadencia_config FOR UPDATE USING (public.user_can_access_empresa(empresa_id, auth.uid())) WITH CHECK (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvcc_delete" ON public.pos_vendas_cadencia_config FOR DELETE USING (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE TRIGGER trg_pvcc_updated_at BEFORE UPDATE ON public.pos_vendas_cadencia_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pos_vendas_followup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadencia_id UUID NOT NULL REFERENCES public.pos_vendas_cadencia_config(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  intervalo_horas INT NOT NULL DEFAULT 24 CHECK (intervalo_horas BETWEEN 1 AND 168),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cadencia_id, ordem)
);
CREATE INDEX idx_pvf_cadencia ON public.pos_vendas_followup(cadencia_id);
ALTER TABLE public.pos_vendas_followup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pvf_all" ON public.pos_vendas_followup FOR ALL
  USING (EXISTS (SELECT 1 FROM public.pos_vendas_cadencia_config c WHERE c.id = cadencia_id AND public.user_can_access_empresa(c.empresa_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pos_vendas_cadencia_config c WHERE c.id = cadencia_id AND public.user_can_access_empresa(c.empresa_id, auth.uid())));

CREATE TABLE public.pos_vendas_lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  marca TEXT NOT NULL,
  uf TEXT NOT NULL,
  dealer_id TEXT NOT NULL,
  movisis_id TEXT,
  loja_nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agente_id, dealer_id)
);
CREATE INDEX idx_pvl_agente_empresa ON public.pos_vendas_lojas(agente_id, empresa_id);
CREATE INDEX idx_pvl_marca_uf ON public.pos_vendas_lojas(marca, uf);
ALTER TABLE public.pos_vendas_lojas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pvl_select" ON public.pos_vendas_lojas FOR SELECT USING (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvl_insert" ON public.pos_vendas_lojas FOR INSERT WITH CHECK (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvl_update" ON public.pos_vendas_lojas FOR UPDATE USING (public.user_can_access_empresa(empresa_id, auth.uid())) WITH CHECK (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE POLICY "pvl_delete" ON public.pos_vendas_lojas FOR DELETE USING (public.user_can_access_empresa(empresa_id, auth.uid()));
CREATE TRIGGER trg_pvl_updated_at BEFORE UPDATE ON public.pos_vendas_lojas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.pos_vendas_gatilho_config IS 'Vincula um gatilho de entrega da Paty (slug do Switch n8n) a um template WhatsApp por agente/empresa.';
COMMENT ON TABLE public.pos_vendas_cadencia_config IS 'Configuração da cadência de agendamentos da Paty: template inicial e limites de interação livre pós-resposta.';
COMMENT ON TABLE public.pos_vendas_followup IS 'Follow-ups ordenados de uma cadência de agendamentos.';
COMMENT ON TABLE public.pos_vendas_lojas IS 'Vínculo agente Paty ↔ loja, com toggle ativo isolado por agente.';
