---
name: Self-chain immediate de campaign jobs
description: process-campaign-job processa 1 batch por isolate e auto-invoca o próximo via fetch; cap 100; mesma cláusula em select+claim.
type: feature
---

Disparos **immediate** (`campaign_batches.lot_index IS NULL`) usam self-chain
desde jun/2026:

- 1 isolate = 1 batch. Ao fim, `fetch` fire-and-forget para
  `process-campaign-job` com header `x-chain-depth` incrementado.
- Cap **100**; ao atingir, aborta com `disparo_falhou` idempotente.
- Seleção do próximo batch e claim (`claim_next_immediate_batch`)
  usam **a mesma cláusula**: `status IN ('pending','failed') OR
  (status='processing' AND updated_at < now() - interval '10 minutes')`.
  `ORDER BY` prioriza `processing` stale.
- Cancel-check (`status='cancelled'` OU `cancelled_at IS NOT NULL`)
  antes de marcar job `processing` e entre elos. Job cancelado nunca
  é ressuscitado; elo aborta com `reason=cancelled`.
- Scheduled (`lot_index` definido) continua no
  `scheduled-campaign-dispatcher` + janela 07–20. **Não tocar.**
- Logs canônicos: `🔗 [CHAIN] start|next-invoked`, `🔚 [CHAIN] end-of-chain`,
  `🏁 [BG] ... skipped_already_dispatched=<n>`.

Detalhe: `docs/fluxo-disparo-whatsapp.md` §13.