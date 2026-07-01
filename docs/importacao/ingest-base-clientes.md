# `ingest-base-clientes` — Ingestão Contínua

**Área:** Importação
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## O que é

Edge Function que consome jobs em `pool_ingestao_jobs` e materializa leads em `pool_clientes_externos` + `contatos` via `bulk_upsert_contatos`. Alimenta o **Pool / DataLake** com histórico rolante de 12 meses.

## Estado atual (jul/2026)

- ~850 mil leads ativos no pool.
- Cobertura de **1 ano completo** atingida após rodada retroativa.
- ~250 jobs processados em `pool_ingestao_jobs`.
- Cadência regular: jobs diários incrementais + retroativos sob demanda.

## Detalhes técnicos

- **Edge:** `supabase/functions/ingest-base-clientes/index.ts`.
- **Tabelas:** `pool_ingestao_jobs` (fila), `pool_clientes_externos` (materialização), `contatos` (canônico), `import_logs` (`origem='ingest'`).
- **RPC:** `bulk_upsert_contatos`.
- **Job schema:** `{ id, empresa_id, arquivo_s3, status, total, processados, iniciado_em, ... }`.
- **Self-chaining:** igual `process-import` — retoma o job em lotes.

## Regras de negócio

- Vínculo em `pool_clientes_externos` **não** cria vínculo em `eventos_prospeccao` — isso só ocorre quando o usuário chama `importar_pool_para_evento` (ver [pool](./importacao-pool.md)).
- Quarentena/opt-out são armazenados por telefone/marca; o bloqueio efetivo acontece no momento do vínculo ao evento.
- Retroativos são idempotentes (upsert canônico por telefone).

## Operação

- Job travado em `processing` sem avanço por >10 min → checar logs; reset via update manual.
- Para retroativo de X dias, inserir job com `arquivo_s3` apontando para o arquivo consolidado.

## Histórico

Consolidado a partir de `status-ingest-base-clientes.md` (v1) e `_v2.md` — removidos após esta consolidação.

## Relacionado

- [Importação do Pool](./importacao-pool.md)
- [`bulk_upsert_contatos`](./bulk-upsert-contatos.md)