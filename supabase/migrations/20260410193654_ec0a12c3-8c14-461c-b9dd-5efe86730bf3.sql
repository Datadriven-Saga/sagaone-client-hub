
-- 1) Tabela
CREATE TABLE IF NOT EXISTS public.contato_timeline (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id   uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  tipo         text NOT NULL,
  descricao    text,
  metadata     jsonb,
  usuario_id   uuid,
  usuario_nome text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contato_timeline_contato ON public.contato_timeline (contato_id, created_at DESC);
CREATE INDEX idx_contato_timeline_tipo ON public.contato_timeline (tipo);

-- 2) RLS
ALTER TABLE public.contato_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_select" ON public.contato_timeline FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contatos c
      WHERE c.id = contato_timeline.contato_id
        AND public.user_can_access_empresa(c.empresa_id, auth.uid())
    )
  );

CREATE POLICY "timeline_insert" ON public.contato_timeline FOR INSERT
  WITH CHECK (true);

-- 3) Trigger: status_change
CREATE OR REPLACE FUNCTION public.fn_timeline_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_nome text;
BEGIN
  SELECT COALESCE(p.nome_completo, 'Sistema') INTO v_nome FROM public.profiles p WHERE p.id = NEW.usuario_id;
  INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_id, usuario_nome, created_at)
  VALUES (NEW.contato_id, 'status_change',
    'Status alterado de ' || COALESCE(NEW.status_anterior,'(vazio)') || ' para ' || COALESCE(NEW.status_novo,'(vazio)'),
    jsonb_build_object('status_de', NEW.status_anterior, 'status_para', NEW.status_novo, 'observacoes', NEW.observacoes),
    NEW.usuario_id, COALESCE(v_nome,'Sistema'), COALESCE(NEW.data_movimentacao, now()));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_timeline_status_change AFTER INSERT ON public.logs_movimentacao_contatos
  FOR EACH ROW EXECUTE FUNCTION public.fn_timeline_status_change();

-- 4) Trigger: anotacao
CREATE OR REPLACE FUNCTION public.fn_timeline_anotacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.tipo_evento::text = 'Anotação' THEN
    INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_nome, created_at)
    VALUES (NEW.contato_id, 'anotacao', LEFT(COALESCE(NEW.descricao, NEW.observacoes,''),500),
      jsonb_build_object('evento_id', NEW.id, 'resultado', NEW.resultado), 'Sistema', COALESCE(NEW.data_evento, now()));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_timeline_anotacao AFTER INSERT ON public.eventos_prospeccao
  FOR EACH ROW EXECUTE FUNCTION public.fn_timeline_anotacao();

-- 5) Trigger: whatsapp_enviado
CREATE OR REPLACE FUNCTION public.fn_timeline_whatsapp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.data_disparo_ia IS NOT NULL AND (OLD IS NULL OR OLD.data_disparo_ia IS NULL) THEN
    INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_nome, created_at)
    VALUES (NEW.contato_id, 'whatsapp_enviado', 'Mensagem WhatsApp enviada',
      jsonb_build_object('evento_prospeccao_id', NEW.id, 'prospeccao_id', NEW.prospeccao_id),
      'Sistema', COALESCE(NEW.data_disparo_ia, now()));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_timeline_whatsapp AFTER UPDATE OF data_disparo_ia ON public.eventos_prospeccao
  FOR EACH ROW EXECUTE FUNCTION public.fn_timeline_whatsapp();

-- 6) Trigger: responsavel_atribuido
CREATE OR REPLACE FUNCTION public.fn_timeline_responsavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF (OLD.responsavel_email IS DISTINCT FROM NEW.responsavel_email) OR (OLD.vendedor_nome IS DISTINCT FROM NEW.vendedor_nome) THEN
    INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_nome)
    VALUES (NEW.id, 'responsavel_atribuido',
      'Responsável atribuído: ' || COALESCE(NEW.vendedor_nome, NEW.responsavel_email, 'N/A'),
      jsonb_build_object('responsavel_email', NEW.responsavel_email, 'vendedor_nome', NEW.vendedor_nome,
        'anterior_email', OLD.responsavel_email, 'anterior_nome', OLD.vendedor_nome), 'Sistema');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_timeline_responsavel AFTER UPDATE OF responsavel_email, vendedor_nome ON public.contatos
  FOR EACH ROW EXECUTE FUNCTION public.fn_timeline_responsavel();

-- 7) Trigger: proposta_atualizada
CREATE OR REPLACE FUNCTION public.fn_timeline_proposta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF OLD.codigo_proposta IS DISTINCT FROM NEW.codigo_proposta AND NEW.codigo_proposta IS NOT NULL THEN
    INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_nome)
    VALUES (NEW.id, 'proposta_atualizada', 'Código de proposta registrado: ' || NEW.codigo_proposta,
      jsonb_build_object('codigo_proposta', NEW.codigo_proposta, 'anterior', OLD.codigo_proposta), 'Sistema');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_timeline_proposta AFTER UPDATE OF codigo_proposta ON public.contatos
  FOR EACH ROW EXECUTE FUNCTION public.fn_timeline_proposta();

-- 8) Trigger: quarentena_entrada
CREATE OR REPLACE FUNCTION public.fn_timeline_quarentena_entrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_cid uuid;
BEGIN
  SELECT c.id INTO v_cid FROM public.contatos c WHERE c.telefone = NEW.telefone_normalizado AND c.empresa_id = NEW.empresa_id LIMIT 1;
  IF v_cid IS NOT NULL THEN
    INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_nome)
    VALUES (v_cid, 'quarentena_entrada',
      'Contato entrou em quarentena (' || COALESCE(NEW.canal,'whatsapp') || ') — ' || COALESCE(NEW.marca,''),
      jsonb_build_object('canal', NEW.canal, 'marca', NEW.marca, 'evento_nome', NEW.evento_nome), 'Sistema');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_timeline_quarentena_entrada AFTER INSERT ON public.contato_quarentena
  FOR EACH ROW EXECUTE FUNCTION public.fn_timeline_quarentena_entrada();

-- 9) Trigger: quarentena_saida
CREATE OR REPLACE FUNCTION public.fn_timeline_quarentena_saida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_cid uuid; v_nome text;
BEGIN
  IF NEW.desativado = true AND (OLD.desativado = false OR OLD.desativado IS NULL) THEN
    SELECT c.id INTO v_cid FROM public.contatos c WHERE c.telefone = NEW.telefone_normalizado AND c.empresa_id = NEW.empresa_id LIMIT 1;
    IF v_cid IS NOT NULL THEN
      SELECT COALESCE(p.nome_completo,'Sistema') INTO v_nome FROM public.profiles p WHERE p.id = NEW.desativado_por;
      INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_id, usuario_nome)
      VALUES (v_cid, 'quarentena_saida',
        'Quarentena encerrada (' || COALESCE(NEW.canal,'whatsapp') || ') — ' || COALESCE(NEW.marca,''),
        jsonb_build_object('canal', NEW.canal, 'marca', NEW.marca), NEW.desativado_por, COALESCE(v_nome,'Sistema'));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_timeline_quarentena_saida AFTER UPDATE OF desativado ON public.contato_quarentena
  FOR EACH ROW EXECUTE FUNCTION public.fn_timeline_quarentena_saida();

-- 10) Trigger: venda
CREATE OR REPLACE FUNCTION public.fn_timeline_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_nome text;
BEGIN
  IF NEW.contato_id IS NOT NULL THEN
    SELECT COALESCE(p.nome_completo,'Sistema') INTO v_nome FROM public.profiles p WHERE p.id = NEW.responsavel_id;
    INSERT INTO public.contato_timeline (contato_id, tipo, descricao, metadata, usuario_id, usuario_nome)
    VALUES (NEW.contato_id, 'venda',
      'Venda registrada' || CASE WHEN NEW.valor_venda IS NOT NULL THEN ' — R$ ' || TRIM(TO_CHAR(NEW.valor_venda,'999G999G999D99')) ELSE '' END,
      jsonb_build_object('numero_venda', NEW.numero_venda, 'valor_venda', NEW.valor_venda, 'data_venda', NEW.data_venda, 'venda_id', NEW.id),
      NEW.responsavel_id, COALESCE(v_nome,'Sistema'));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_timeline_venda AFTER INSERT ON public.vendas_prospeccao
  FOR EACH ROW EXECUTE FUNCTION public.fn_timeline_venda();

-- 11) RPC
CREATE OR REPLACE FUNCTION public.get_contato_timeline(
  p_contato_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0
)
RETURNS TABLE (id uuid, tipo text, descricao text, metadata jsonb, usuario_nome text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT id, tipo, descricao, metadata, usuario_nome, created_at
  FROM public.contato_timeline WHERE contato_id = p_contato_id
  ORDER BY created_at DESC LIMIT p_limit OFFSET p_offset;
$$;
