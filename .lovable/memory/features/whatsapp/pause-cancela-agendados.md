---
name: Pausa de template cancela disparos programados
description: template-paused-webhook cancela jobs scheduled/pending/processing/partially_completed e marca lotes futuros como failed; notifica o user_id dono do job
type: feature
---

Quando a Meta pausa um template e a Lambda chama
`template-paused-webhook`, o STEP 4 cancela TODOS os `campaign_jobs`
ativos das prospeccoes afetadas, incluindo `dispatch_mode='scheduled'`.

- `campaign_jobs.status IN ('pending','processing','scheduled','partially_completed')`
  → `status='cancelled'`, `cancelled_at=now()`,
  `error_message='Template pausado pela Meta'`.
- `campaign_batches` desses jobs com status
  `scheduled`/`pending`/`processing` → `status='failed'`,
  `error_log='Template pausado pela Meta'`. A tabela não aceita
  `cancelled` (check constraint atual permite apenas
  pending/processing/completed/failed/scheduled), por isso usamos
  `failed` — mesmo padrão do `ActiveCampaignJobIndicator`.
- Lotes já `completed`/`failed` não são tocados.
- Para cada job cancelado, insere `notificacoes` tipo
  `disparo_cancelado_template_pausado` para o `user_id` do job,
  apontando para `/prospeccao/{prospeccao_id}?job={job_id}`.

Antes desta correção (validada em jun/2026 com o job
`63ddafb0-f26c-469b-bbb8-14cc4a91c4e7`, evento "Feirão da copa grupo
saga" / GM VGD), jobs `scheduled` ficavam vivos e o
`scheduled-campaign-dispatcher` reivindicava cada lote, que falhava no
`process-campaign-job` porque `template_*_id` já havia sido zerado no
STEP 3.