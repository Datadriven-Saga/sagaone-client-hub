---
name: Quarentena RPC perf — coluna expira_em e busca por prefixo
description: Coluna expira_em em contato_quarentena (mantida por trigger), índice text_pattern_ops para LIKE prefix em telefone, RPC sem JOIN com quarentena_config
type: feature
---
## Otimização do `get_quarentena_paginated`

- Coluna `expira_em timestamptz` em `contato_quarentena` mantida pelo trigger `trg_set_quarentena_expira_em` (BEFORE INSERT/UPDATE OF data_fim_evento, canal). Fórmula: `data_fim_evento + (CASE canal WHEN 'whatsapp' THEN 20 ELSE 30 END) * interval '1 day'`.
- O RPC NÃO faz mais JOIN com `quarentena_config` (tabela está vazia). Status (ativo/expirado) é derivado de `expira_em` vs `now()`.
- Busca de telefone usa `LIKE 'xxx%'` quando `p_search` contém só dígitos/separadores (>=3 dígitos). Texto vira prefix em `lower(evento_nome)`/`lower(marca)`.
- Índices novos:
  - `idx_quarentena_telefone_prefix (telefone_normalizado text_pattern_ops)` — busca prefixo
  - `idx_quarentena_ativo_expira (expira_em) WHERE desativado=false` — stats
  - `idx_quarentena_marca_impacto (marca, ultimo_impacto_at DESC)` — listagem por marca
- Se no futuro `quarentena_config` voltar a ser usada, reintroduzir a denormalização via trigger (ler dias por empresa+marca+canal e gravar em `expira_em`), não voltar a fazer JOIN no RPC.
- Validado: prefixo telefone em ~3ms; antes seq scan em 495k linhas causava 57014.