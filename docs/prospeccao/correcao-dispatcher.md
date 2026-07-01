# Correção do Despachador de Disparos Programados

> Data: 23/06/2026
> Escopo: `scheduled-campaign-dispatcher` + RPC `claim_due_campaign_batches` + `cron.job` 6
> Relacionados: [`fluxo-disparo-whatsapp.md`](./fluxo-disparo-whatsapp.md) §11.4, [`recuperacao-jobs-orfaos.md`](./recuperacao-jobs-orfaos.md)

---

## 1. Contexto

Reportado pelo usuário: o evento da Hyundai CBA (prospecção `0dc6e182-aa2c-47b9-a744-6e0bfdbd42cb`) tinha disparo programado desde 16:00 BRT (19:00 UTC) e nenhum lote havia saído. Pedido: validar se o agendamento estava funcionando de fato e se o problema era de back-end ou apenas de exibição no front.

## 2. Diagnóstico

### 2.1 Caso Hyundai CBA
- Job `23a45ad7-ea60-41ee-ade4-e21b14daa6e2`, `dispatch_mode=scheduled`, cadência `by_lot_size`, intervalo 30 min.
- 6.580 contatos / 27 lotes de 250, primeiro slot 23/06 19:00 UTC.
- Às 20:07 UTC: 12 lotes deveriam ter rodado, **0 foram reivindicados**. Status do job ainda em `scheduled`, `locked_at` NULL em todos os batches.

### 2.2 Estado do sistema
- 13 jobs `scheduled`/`processing` ativos; ~124 batches overdue acumulados no momento da análise.
- Vários jobs em `processing` com alguns lotes andando, outros (incluindo Hyundai) sem nenhum claim.

### 2.3 Causa raiz confirmada
- `cron.job` 6 executava `*/30` → 2 ticks por hora.
- `scheduled-campaign-dispatcher` chamava `claim_due_campaign_batches(p_limit=10)` → no máximo 10 lotes por tick.
- **Capacidade teórica: apenas 20 lotes/hora para todo o cluster.**
- `claim_due_campaign_batches` ordenava por `scheduled_at ASC, lot_index ASC NULLS LAST`. Quando vários jobs caem no mesmo slot, o tie-breaker era só `lot_index` → sempre os mesmos jobs ganhavam e outros (como Hyundai) ficavam preteridos tick após tick.
- `cron.job_run_details` confirma que os ticks 19:00 / 19:30 / 20:00 rodaram com sucesso — não era cron parado, era throughput insuficiente.

### 2.4 Hipóteses descartadas
- Bug de visibilidade no front. `useScheduledCampaignJobs` reflete fielmente `campaign_jobs` + `campaign_batches`.
- Cron parado ou dispatcher quebrado.
- Janela operacional 07–20 BRT bloqueando (19:00 UTC = 16:00 BRT, dentro da janela).
- Cancelamento (`cancelled_at`) ou `disparos_pausados` na prospecção.

## 3. Correções aplicadas

### 3.1 Migração — `claim_due_campaign_batches` com fairness
Reescrita da RPC para usar `ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY scheduled_at, lot_index)` como primeiro critério de ordenação. Garante distribuição round-robin: cada job recebe 1 lote antes de qualquer job receber o segundo. Mantém `FOR UPDATE SKIP LOCKED` e `SECURITY DEFINER`.

```sql
CREATE OR REPLACE FUNCTION public.claim_due_campaign_batches(p_limit integer DEFAULT 10, p_worker_id text DEFAULT 'cron')
RETURNS SETOF campaign_batches
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT cb.id,
           ROW_NUMBER() OVER (
             PARTITION BY cb.job_id
             ORDER BY cb.scheduled_at ASC, cb.lot_index ASC NULLS LAST
           ) AS rn_per_job,
           cb.scheduled_at, cb.lot_index
    FROM public.campaign_batches cb
    JOIN public.campaign_jobs cj ON cj.id = cb.job_id
    JOIN public.prospeccoes p ON p.id = cj.prospeccao_id
    WHERE cb.status = 'scheduled'
      AND cb.scheduled_at <= now()
      AND cj.status IN ('scheduled','processing','partially_completed')
      AND cj.cancelled_at IS NULL
      AND COALESCE(p.disparos_pausados, false) = false
  ),
  due AS (
    SELECT r.id
    FROM ranked r
    ORDER BY r.rn_per_job ASC, r.scheduled_at ASC, r.lot_index ASC NULLS LAST
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.campaign_batches cb
  SET status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      started_at = COALESCE(cb.started_at, now()),
      updated_at = now()
  FROM due
  WHERE cb.id = due.id
  RETURNING cb.*;
END;
$function$;
```

### 3.2 Migração — `get_dispatcher_backlog()`
Nova função `STABLE` / `SECURITY DEFINER` que devolve `overdue_total`, `jobs_overdue` e `oldest_scheduled_at`. Permite monitoria do tamanho da fila em tempo real, tanto pelos logs da edge quanto por uma futura tela administrativa.

```sql
SELECT * FROM public.get_dispatcher_backlog();
--  overdue_total | jobs_overdue | oldest_scheduled_at
```

### 3.3 Edge function `scheduled-campaign-dispatcher`
- `p_limit` aumentado de **10 → 50** por tick.
- Snapshot de backlog antes do claim, logado como `📊 [DISPATCHER] backlog overdue_total=… jobs_overdue=… oldest=…`.
- Log do tick agora inclui `worker_id`, `claimed`, jobs distintos e `limit`.

### 3.4 Cron job 6
Atualizado via `cron.alter_job(job_id := 6, schedule := '*/5 * * * *')`. Vazão teórica passou de **20 → ~600 lotes/hora** cluster-wide.

## 4. Antes × Depois

| Antes | Depois |
|---|---|
| Cron a cada 30 minutos | Cron a cada 5 minutos |
| 10 lotes por tick | 50 lotes por tick |
| ~20 lotes/hora cluster-wide | ~600 lotes/hora cluster-wide |
| Ordenação por `scheduled_at + lot_index` (sem fairness) | Round-robin por `job_id` (todo job pega 1 lote antes de repetir) |
| Sem visibilidade de backlog | Log por tick + RPC `get_dispatcher_backlog()` |

## 5. Catch-up imediato

Após as mudanças, a edge foi invocada manualmente em sequência (5 ticks com 3 s de intervalo) para drenar o backlog acumulado:

- Tick 1: 50 lotes reivindicados.
- Tick 2: 50 lotes reivindicados.
- Tick 3: 16 lotes reivindicados.
- Ticks 4 e 5: 0 lotes — fila zerada.

Total: **116 lotes recuperados**, distribuídos entre todos os jobs ativos graças ao round-robin.

## 6. Validação

Imediatamente após o catch-up, o job da Hyundai CBA apresentava:

- `job.status = processing`.
- 12 lotes em `processing` simultaneamente.
- 15 lotes ainda `scheduled` (slots futuros de 30 em 30 min — comportamento esperado).
- `processed_records = 35` e crescendo.
- 0 falhas de batch.

## 7. O que NÃO foi alterado

- `process-campaign-job` (self-chain de imediatos, contrato WhatsApp, rate-limit interno 5 req/500 ms).
- `bulk_upsert_contatos`, `upsert_quarentena`, `contato_quarentena` — fora do escopo.
- Janela operacional 07–20 BRT no dispatcher (regra de negócio).
- `dispatch-leads-webhook` e `logs_disparos` server-side.
- Layout do modal "Lotes programados" — já refletia o estado real do banco corretamente.

## 8. Monitoramento contínuo

- Logs do `scheduled-campaign-dispatcher`: procurar `📊 [DISPATCHER] backlog` por tick. `overdue_total` estável próximo de zero = saudável.
- SQL ad-hoc: `SELECT * FROM get_dispatcher_backlog();`.
- `cron.job_run_details WHERE jobid = 6` — confirma execução a cada 5 min.

## 9. Arquivos alterados

- Migração: `claim_due_campaign_batches` (REPLACE) + `get_dispatcher_backlog` (CREATE).
- `supabase/functions/scheduled-campaign-dispatcher/index.ts`.
- `cron.job` 6 — schedule alterado via `cron.alter_job`.