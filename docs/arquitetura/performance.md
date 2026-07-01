# Performance e Limites

**Área:** Arquitetura
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## Limites conhecidos

| Recurso | Limite | Mitigação |
|---|---|---|
| Edge Function (execução) | 150 s | **Self-chaining** (`process-import`, `process-campaign-job`, `ingest-base-clientes`) |
| Supabase query default | 1000 linhas | Sempre paginar; keyset preferido a offset |
| Meta WPP throughput | 5 req/500 ms | `campaign_batches` respeita janela; 1 isolate = 1 batch (memory `self-chain-immediate`) |
| URL UUID em edge | ~200 chars | Passar arrays via body, não query string |
| Kanban sem filtro | Timeout 57014 | RPC exige `prospeccaoIds`; default por perfil (memory `kanban-default-filter-and-timeout-prevention`) |
| `auth.admin.listUsers` | 500 error em contas grandes | Substituído por RPC (memory `manage-users-performance-fix`) |

## Cron / dispatchers

| Job | Intervalo | Função |
|---|---|---|
| `scheduled-campaign-dispatcher` | 5 min | Reivindica lotes vencidos, dispara em round-robin |
| Opt-out sync externo | Diário | Snapshot de opt-outs para uso no dia |
| Sync empresas/cadeiras | Sob demanda | Update de mapping CRM |

## RPCs de performance crítica

- **`get_pool_clientes_for_empresa`** — keyset paginado com máscara por perfil.
- **`get_kanban_leads`** — server-side load com filtros compostos (memory `kanban-server-side-loading`).
- **`claim_next_immediate_batch`** — SELECT+CLAIM atômico para evitar dupla execução.
- **`claim_due_campaign_batches`** — round-robin cross-empresa.

## Índices críticos

- `idx_contatos_tel_last4` — busca por 4 últimos dígitos (recepção).
- `idx_contatos_temperatura` — filtro Kanban por temperatura (parcial).
- Índice parcial `contato_quarentena WHERE marca IS NOT NULL` — `ON CONFLICT` do `upsert_quarentena` (memory `perf-expira-em-and-prefix-search`).

## Otimizações no FE

- **Optimistic updates** em toggles (Entregas, temperatura).
- **Custom events** para invalidar caches locais sem `refetch` completo (`lead-temperatura-updated`).
- **Realtime** só onde necessário; sempre com cleanup em `useEffect`.

## Regras

- Sempre `DISTINCT contato_id` em agregações.
- Nunca query aberta no Kanban.
- Edge nova → self-chain se houver risco de >120 s.

## Relacionado

- [Visão geral](./visao-geral.md)
- [Disparo WhatsApp](../prospeccao/dispatch-whatsapp.md)
- [Recuperação de jobs órfãos](../prospeccao/recuperacao-jobs-orfaos.md)