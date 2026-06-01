DO $$
DECLARE
  p uuid := '7ad33475-2aad-4f19-8728-c1197712b702';
  c uuid := '6bdb74c1-cbd9-419e-bd06-d923c21c6ce2';
BEGIN
  -- por contato
  DELETE FROM public.notificacoes WHERE contato_id = c;
  DELETE FROM public.contato_anotacoes WHERE contato_id = c;
  DELETE FROM public.contato_timeline WHERE contato_id = c;
  DELETE FROM public.vendas_prospeccao WHERE contato_id = c;
  DELETE FROM public.eventos_prospeccao WHERE contato_id = c;
  DELETE FROM public.contatos WHERE id = c;

  -- por prospeccao
  DELETE FROM public.contato_anotacoes WHERE prospeccao_id = p;
  DELETE FROM public.eventos_prospeccao WHERE prospeccao_id = p;
  DELETE FROM public.prospeccao_convites WHERE prospeccao_id = p;
  DELETE FROM public.prospeccao_equipes WHERE prospeccao_id = p;
  DELETE FROM public.prospeccao_marketing WHERE prospeccao_id = p;
  DELETE FROM public.prospeccao_metas_individuais WHERE prospeccao_id = p;
  DELETE FROM public.prospeccao_outras_premiacoes WHERE prospeccao_id = p;
  DELETE FROM public.prospeccao_paginas WHERE prospeccao_id = p;
  DELETE FROM public.vendas_prospeccao WHERE prospeccao_id = p;
  DELETE FROM public.recepcao_visitas WHERE prospeccao_id = p;
  DELETE FROM public.contato_quarentena WHERE prospeccao_id = p;
  DELETE FROM public.notificacoes_importacao WHERE prospeccao_id = p;
  DELETE FROM public.campaign_jobs WHERE prospeccao_id = p;
  DELETE FROM public.import_logs WHERE prospeccao_id = p;
  DELETE FROM public.pool_segmentacoes WHERE prospeccao_id = p;
  DELETE FROM public.logs_prospeccoes WHERE prospeccao_id = p;
  DELETE FROM public.logs_disparos WHERE prospeccao_id = p;
  DELETE FROM public.logs_movimentacao_contatos WHERE prospeccao_id = p;

  DELETE FROM public.prospeccoes WHERE id = p;
END $$;