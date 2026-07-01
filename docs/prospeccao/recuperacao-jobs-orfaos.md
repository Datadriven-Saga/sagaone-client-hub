# Recuperação de jobs immediate órfãos

> Contexto: a partir de jun/2026 disparos immediate usam **self-chain**
> ([`dispatch-whatsapp.md`](./dispatch-whatsapp.md) §13). Este documento descreve o que
> acontece quando a cadeia é interrompida e como o sistema se recupera.

## Cenário

Um isolate do `process-campaign-job` cai mid-batch (kill, OOM, deploy,
timeout do gateway). O batch fica em `status='processing'` com
`updated_at` parado. Sem auxílio, o `campaign_jobs` correspondente fica
em `processing` para sempre.

## Recuperação primária — frontend (Opção A)

`src/components/ActiveCampaignJobIndicator.tsx` é o disparador. Quando
detecta job parado há >10 min (`STUCK_THRESHOLD_MS`):

1. Verifica que não há `campaign_batches.status='scheduled'` no futuro
   (entre-lotes programados não é travamento).
2. **Tenta retomar** chamando `process-campaign-job` com `{ job_id }`.
   A edge function, via `claim_next_immediate_batch`, reivindica
   qualquer batch elegível (`pending`/`failed` ∪ `processing > 10min`)
   e re-engata a cadeia.
3. Insere notificação `disparo_retomado` (tipo registrado em
   `src/lib/notifications/registry.ts`).
4. Faz poll de `campaign_jobs.updated_at` por 90 s. Se avançou ou o
   status virou terminal (`completed`/`partially_completed`/`cancelled`/
   `failed`) → sucesso, encerra.
5. Se não progrediu: marca job como `completed` com
   `error_message='Finalizado automaticamente (sem atividade por 10+ min)'`,
   batches `pending`/`processing` viram `failed`, dispara
   `disparo_falhou` idempotente por `link`.

Flag local `recoveryAttempted` (Map por `job.id`) impede loop de
re-tentativa dentro de uma mesma janela de 10 min.

### Limitação aceita

**A recuperação automática depende deste componente estar montado** —
ou seja, algum usuário com a empresa do job aberta na UI. Sem ninguém
na tela após um crash mid-chain, o batch fica órfão até alguém abrir
a UI ou acionar **"Retomar Falhas"** no `EventoBase`. Recuperação
server-side (cron varrendo jobs órfãos) está **fora desta fase**.

## Fallback manual

- **"Retomar Falhas"** (`EventoBase.tsx`): reagenda `pending`/`failed`
  do job.
- Cancelar manualmente via `DisparosProgramadosList`.

## Componentes server-side

### RPC `claim_next_immediate_batch(p_job_id uuid, p_max_retries int)`

- `SECURITY DEFINER`, `EXECUTE` apenas para `service_role`.
- Seleciona o próximo batch `lot_index IS NULL` com a cláusula
  unificada (ver §13 do fluxo). `ORDER BY processing-stale primeiro,
  depois batch_index`. Atualiza atomicamente para `processing` com
  `started_at`/`updated_at = now()` e retorna `id`, `batch_index`,
  `prev_status`.

### View `vw_immediate_jobs_status`

- `security_invoker = true`, filtrada por `user_can_access_empresa(j.empresa_id, auth.uid())`.
- Classifica cada job immediate como `vivo`, `orfao` ou `concluido`.
- `immediate_open` conta batches elegíveis (mesma cláusula).
- Uso típico: query de diagnóstico no SQL editor ou painel admin.

## Notificações

| Tipo | Quando |
|---|---|
| `disparo_retomado` | Frontend dispara recuperação automática (antes de marcar `failed`). |
| `disparo_falhou` | Recuperação não progrediu em 90 s, ou cap de self-chain atingido. Idempotente por `link`. |

## Checklist de verificação

- [ ] Kill isolate mid-batch → após 10 min e UI aberta, batch
      `processing` é reivindicado e cadeia retoma.
- [ ] Job cancelado mid-chain → próximo elo aborta com
      `🔚 [CHAIN] end-of-chain reason=cancelled`.
- [ ] Sem UI aberta após crash → batch fica órfão até "Retomar Falhas".
      (Comportamento conhecido / Opção A.)
- [ ] `vw_immediate_jobs_status` exibe apenas jobs das empresas do
      usuário logado.