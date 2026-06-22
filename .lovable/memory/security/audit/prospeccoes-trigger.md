---
name: Auditoria forense em prospeccoes
description: Trigger AFTER INSERT/UPDATE/DELETE em public.prospeccoes grava em logs_prospeccoes mudanças de campos sensíveis (templates, datas, canal, flags) com autor identificado
type: feature
---

Trigger `trg_audit_prospeccoes` (function `public.tg_audit_prospeccoes`,
`SECURITY DEFINER`, `search_path=public`) registra em `logs_prospeccoes`:

- `acao='desassociacao_template'` quando algum `template_*_id` vira NULL.
- `acao='edicao_evento'` para outras mudanças sensíveis.
- `acao='criacao_evento'` no INSERT, `acao='remocao_evento'` no DELETE.
- `acao='desassociacao_template_historico'` foi inserida manualmente para
  o caso HYUNDAI CBA / Feirão Da Copa (`prospeccao_id=0dc6e182-…`) cujo
  template foi zerado antes desta trigger existir.

Campos auditados:
`template_prospeccao_id, template_agendado_id, template_nao_agendado_id,
template_agendado_48h_id, template_agendado_24h_id, disparos_pausados,
ativo, event_id_pri, canal, data_inicio, data_fim, evento_confirmacao,
snapshot_realizado`.

Quando `auth.uid()` é NULL (service_role / edge function / SQL direto), o
campo `detalhes` (TEXT contendo JSON) registra `application_name`,
`session_user`, `current_user`, e — quando disponível via PostgREST —
`client_ip`, `user_agent`, `function_caller`, `referer`.

A trigger captura qualquer exceção e emite `RAISE WARNING`, NUNCA aborta
a transação principal.
