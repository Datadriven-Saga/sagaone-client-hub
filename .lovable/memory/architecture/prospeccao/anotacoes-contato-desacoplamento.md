---
name: Anotações desacopladas de eventos_prospeccao
description: Anotações de SDR vivem em contato_anotacoes (pertencem ao contato/lead), não em eventos_prospeccao. prospeccao_id é metadado opcional.
type: feature
---
Anotações de SDR são gravadas em `public.contato_anotacoes` (campos: contato_id, usuario_id, empresa_id, descricao, prospeccao_id opcional).

Regras:
- Anotação pertence ao **contato/lead**, nunca ao evento. Nunca usar `prospeccoes[0]?.id` como fallback — passar `undefined` quando não houver filtro único de evento.
- Edge function `prospeccao-anotacao` insere em `contato_anotacoes` (não mais em `eventos_prospeccao`).
- Trigger `trg_contato_anotacao_timeline` propaga INSERT pra `contato_timeline` automaticamente.
- RLS: SELECT/INSERT validado via `user_empresas`; UPDATE/DELETE só pelo `usuario_id = auth.uid()`.
- Frontend (`ContatoModal`) lê de `contato_anotacoes`, não de `eventos_prospeccao` com `tipo_evento='Anotação'`.

Migração histórica (24.762 registros): migrados de `eventos_prospeccao` preservando `prospeccao_id` original como metadado. 244 órfãos (sem `usuario_id`) permanecem só no backup `eventos_prospeccao_backup_anotacoes`. Fase 5 (DELETE das anotações antigas em `eventos_prospeccao`) pendente — aguarda validação SDR.

Por que: anotações em `eventos_prospeccao` inflavam métricas (DISTINCT contato_id contava leads-fantasma) e vazavam dados entre eventos quando o frontend passava evento errado como contexto.
