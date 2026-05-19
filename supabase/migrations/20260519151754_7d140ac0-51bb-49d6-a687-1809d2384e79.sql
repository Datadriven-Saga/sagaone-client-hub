INSERT INTO public.contato_timeline (contato_id, tipo, descricao, usuario_nome, metadata)
SELECT c.id, 'agente_ia_atribuido', 'Pri IA tocou o lead', 'Pri IA',
       jsonb_build_object('agente','pri','origem','retroativo')
FROM public.contatos c
WHERE 'pri' = ANY(c.agente_ia)
  AND NOT EXISTS (
    SELECT 1 FROM public.contato_timeline t
    WHERE t.contato_id = c.id AND t.tipo = 'agente_ia_atribuido'
  );