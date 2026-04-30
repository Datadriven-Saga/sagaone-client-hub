---
name: phone-match-variants
description: Match de telefone em quarentena/opt-out/exclusões aceita as duas variantes (10 e 11 dígitos) via helpers SQL — sem backfill
type: feature
---

## Padrão: normalização como leitura

Para tolerar histórico com formatos mistos (10 dígitos canônico vs 11 dígitos com 9), todo predicado de match contra telefones agora usa `phone_match_variants(text)` ao invés de comparação literal.

## Helpers SQL (IMMUTABLE)

- `public.normalize_phone_br(text) → text` — retorna canônico 10 dígitos (DDD + 8). Remove DDI 55 (12/13 dígitos) e 9º dígito de celular.
- `public.phone_match_variants(text) → text[]` — retorna `[10d, 11d, raw]` para uso em `= ANY(...)`.

## Pontos que usam o match tolerante

- `bulk_upsert_contatos` — `quarentena_exclusoes` e `contato_quarentena` (LATERAL com `ORDER BY desativado ASC` para priorizar registro liberado).
- `check_quarentena` — mesmo padrão LATERAL.
- `check_global_opt_out` / `check_global_opt_out_bulk` — `WHERE telefone_normalizado = ANY(phone_match_variants(...))`.
- Qualquer RPC futura de dispatch/blacklist deve seguir o mesmo padrão.

## Regra de escrita

A escrita NÃO foi alterada. `upsert_quarentena` continua persistindo o telefone exatamente como recebido. Não há backfill nem trigger de normalização — apenas leitura tolerante.

## Por quê

Manualmente desativar um registro de quarentena em formato 11 dígitos não liberava o mesmo contato armazenado também em 10 dígitos (data drift histórico). O match por variantes resolve sem reescrever histórico.
