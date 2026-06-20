---
name: Recuperação de jobs immediate órfãos — depende do frontend
description: Recuperação automática de batch immediate travado depende do ActiveCampaignJobIndicator montado; sem UI aberta, fallback é Retomar Falhas. Opção A aceita.
type: constraint
---

Recuperação de jobs immediate em `processing` há >10 min é disparada por
`src/components/ActiveCampaignJobIndicator.tsx`. Ele chama
`process-campaign-job` antes de marcar `failed`, faz poll de
`updated_at` por 90 s e emite notificação `disparo_retomado` quando
volta.

**Limitação aceita (Opção A):** se ninguém estiver com a empresa do
job aberta na UI, o batch fica órfão até alguém abrir a tela ou
acionar "Retomar Falhas". Recuperação server-side por cron está
**fora de escopo** desta fase.

**Why:** custo de implementar um cron varredor não compensa o caso
esperado (crash mid-chain enquanto a sala está vazia é raro).

Diagnóstico: `vw_immediate_jobs_status`
(`security_invoker`, `user_can_access_empresa`) classifica jobs em
`vivo`/`orfao`/`concluido`. Detalhe em
`docs/recuperacao-jobs-orfaos.md`.