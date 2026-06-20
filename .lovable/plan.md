## Objetivo

Eliminar "disparo immediate pendente para sempre" via self-chain por invocação, sem mexer no cron de agendados nem na janela 07–20. Incorporar todos os ajustes obrigatórios da revisão (incluindo os dois últimos: revalidação por `eventos_prospeccao.data_disparo_ia` e seleção do próximo batch espelhando a claim). Validar (sem alterar código) que o fluxo de template pausado pela Meta continua executando ponta a ponta.

## Parte A — Validação do fluxo de template pausado (sem código novo)

### O que o fluxo deve fazer (e está fazendo hoje)

`supabase/functions/template-paused-webhook/index.ts` é chamada pela Lambda quando a Meta marca o template como pausado. Em ordem:

1. **Lock atômico** em `template_pausado_log` via índice único parcial em `id_meta_original WHERE status NOT IN ('failed','resolved','cancelled')` — impede recovery duplicado.
2. Busca todos os `whatsapp_templates` com `id_meta` recebido e marca `status_meta='PAUSED'`.
3. Para cada um dos 5 `TEMPLATE_FIELDS` em `prospeccoes` (`template_prospeccao_id`, `template_agendado_id`, `template_nao_agendado_id`, `template_agendado_48h_id`, `template_agendado_24h_id`) com `canal ILIKE '%whatsapp%'`: **desassocia o campo** (`NULL`) e seta `disparos_pausados=true` — bloqueia novos disparos até vincular template aprovado.
4. **Cancela** todos os `campaign_jobs` em `pending`/`processing` das prospeccoes afetadas com `error_message='Template pausado pela Meta'`.
5. **Duplica o template por empresa** com nome `<base>_v<N+1>`, body com `tweakBodyText`, chama `trigger-webhook → novo_template_whatsapp`. Sem `template_id_pri` da Meta → **rollback**.
6. Marca log como `awaiting_approval` (sucesso) ou `failed`.

### Evidência de saúde atual (`template_pausado_log`)

```text
2026-06-19 18:38  id_meta=4420455864866490  awaiting_approval  dup=d4fcbe1f...  eventos=2
2026-06-19 13:24  id_meta=1303939155122936  awaiting_approval  dup=db683ff2...  eventos=4
2026-06-18 19:41  id_meta=2252790068800057  awaiting_approval  dup=87a8c468...  eventos=3
2026-06-18 13:23  id_meta=2074531043175582  awaiting_approval  dup=37b6787e...  eventos=2
```

O evento de hoje (`4420455864866490`, o do log que você colou) entrou em `awaiting_approval` com `template_duplicado_id` populado e 2 eventos impactados.

### Checks read-only

1. `id_meta=4420455864866490`: originais com `status_meta='PAUSED'`; existe `_v<N+1>` com `template_id_pri` não-nulo; prospeccoes afetadas com `disparos_pausados=true` e campos `template_*_id` zerados; `campaign_jobs` ativos → `cancelled`.
2. Confirmar gate de `disparos_pausados=true` na UI (`EventoBase`/`DispararCustoModal`) e no `process-campaign-job` (server-side). Se gate server-side não existir, abrir item separado — **não** corrigir nesta entrega.
3. Confirmar que vincular template aprovado + desmarcar `disparos_pausados` libera "Retomar Falhas" (rotina `paused-template-resolution-logic`).

## Parte B — Self-chain immediate (com todos os ajustes)

### Princípios

- Self-chain **só para immediate** (`lot_index IS NULL`).
- `scheduled-campaign-dispatcher` e janela 07–20 intactos.
- Sem limitador global; cap `x-chain-depth=100`.
- Recuperação primária por frontend (`ActiveCampaignJobIndicator`) — limitação documentada.

### 1. `process-campaign-job/index.ts`

#### 1.1 Seleção do próximo batch immediate (mesma regra da claim, com prioridade para `processing` stale)

```sql
SELECT id, batch_index, status
FROM campaign_batches
WHERE job_id = ?
  AND lot_index IS NULL
  AND retry_count < MAX_RETRIES
  AND (
    status IN ('pending','failed')
    OR (status = 'processing' AND updated_at < now() - interval '10 minutes')
  )
ORDER BY
  CASE WHEN status = 'processing' THEN 0 ELSE 1 END,
  batch_index
LIMIT 1;
```

`processing` velho representa trabalho interrompido e tem prioridade sobre `pending`. Usada nos dois pontos: (a) primeira escolha quando a invocação não recebe `batch_id`, (b) escolha do próximo elo após o batch corrente terminar.

#### 1.2 Claim leve com a mesma regra

```sql
UPDATE campaign_batches
SET status='processing', updated_at=now()
WHERE id = ?
  AND (
    status IN ('pending','failed')
    OR (status = 'processing' AND updated_at < now() - interval '10 minutes')
  )
RETURNING id;
```

Se 0 linhas, encerra o elo: `🔚 [CHAIN] end-of-chain reason=already_claimed`. **Seleção e claim usam exatamente a mesma cláusula** — sem isso o critério de aceite "claim recupera batch em processing >10min" não passa.

#### 1.3 Cancelamento antes de marcar job `processing`

Antes do `UPDATE campaign_jobs SET status='processing'`, ler `status` e `cancelled_at`. Se `'cancelled'` ou `cancelled_at IS NOT NULL`: log `reason=cancelled`, não ressuscita e não auto-invoca.

#### 1.4 Revalidação via `eventos_prospeccao.data_disparo_ia` (espelhando scheduled)

Antes de montar o payload da Lambda no caminho immediate, filtrar os leads do batch por `eventos_prospeccao` com `prospeccao_id = job.prospeccao_id` e `contato_id IN (...)`, descartando quem já tem `data_disparo_ia IS NOT NULL`. Sem fallback em `contatos.data_disparo_ia` (tabela grande, custo alto, e o gate canônico do scheduled é `eventos_prospeccao`). Logar `skipped_already_dispatched=<n>` no `🏁 [BG]`.

#### 1.5 Encadeamento

Ao fim do batch: rodar a query do 1.1; se vier linha e `x-chain-depth < 100`, fire-and-forget `fetch` para `${SUPABASE_URL}/functions/v1/process-campaign-job` com `Authorization: Bearer ${SERVICE_ROLE_KEY}`, `x-chain-depth: <n+1>`, body `{ job_id }` (sem `batch_id`, mantém roteamento immediate).

Cap atingido: aborta cadeia, seta `error_message='Cap de self-chain atingido (100)'`, notificação `disparo_falhou` idempotente por link.

### 2. Chunking — sem mudança (teste 2.500 corrigido)

Frontend cria batches raiz de 1.000 → 1.000/1.000/500. Chunking de 250 ⇒ **3 raiz immediate + 7 filhos scheduled = 10 batches**:

```text
self-chain processa os 3 raiz (lot_index IS NULL)
cron drena os 7 filhos (lot_index definido)
nenhum batch lot_index IS NULL fica órfão
```

### 3. Observabilidade (sem PII)

```text
🔗 [CHAIN] start job=<id> batch_id=<id> batch_index=<n> depth=<n> prev_status=<s> lead_count=<n>
🏁 [BG] Batch finalizado job=<id> batch_index=<n> final_status=<s> processed=<n> failed=<n> duplicate=<n> skipped_already_dispatched=<n> duration_ms=<n>
🔗 [CHAIN] next-invoked job=<id> next_batch_index=<n> next_prev_status=<s> depth=<n+1>
🔚 [CHAIN] end-of-chain job=<id> reason=<no_more|cap_reached|cancelled|already_claimed>
```

### 4. View `vw_immediate_jobs_status` (multi-tenant)

```sql
CREATE OR REPLACE VIEW public.vw_immediate_jobs_status
WITH (security_invoker = true) AS
SELECT j.id AS job_id, j.empresa_id, j.prospeccao_id, j.status AS job_status,
       j.total_records, j.processed_records, j.failed_records,
       j.started_at, j.updated_at, j.completed_at,
       COUNT(b.id) FILTER (WHERE b.lot_index IS NULL) AS immediate_batches_total,
       COUNT(b.id) FILTER (
         WHERE b.lot_index IS NULL
           AND (b.status IN ('pending','failed')
                OR (b.status='processing' AND b.updated_at < now() - interval '10 minutes'))
       ) AS immediate_open,
       CASE
         WHEN j.status IN ('completed','partially_completed','cancelled','failed') THEN 'concluido'
         WHEN COUNT(b.id) FILTER (
           WHERE b.lot_index IS NULL
             AND (b.status IN ('pending','failed')
                  OR (b.status='processing' AND b.updated_at < now() - interval '10 minutes'))
         ) > 0 THEN 'orfao'
         ELSE 'vivo'
       END AS classificacao
FROM public.campaign_jobs j
LEFT JOIN public.campaign_batches b ON b.job_id = j.id
WHERE EXISTS (SELECT 1 FROM public.campaign_batches b2 WHERE b2.job_id = j.id AND b2.lot_index IS NULL)
  AND public.user_can_access_empresa(j.empresa_id)
GROUP BY j.id;

GRANT SELECT ON public.vw_immediate_jobs_status TO authenticated;
GRANT SELECT ON public.vw_immediate_jobs_status TO service_role;
```

`security_invoker=true` + filtro `user_can_access_empresa` garantem isolamento multi-tenant. A coluna `immediate_open` usa a mesma regra de "elegível" das seções 1.1/1.2.

### 5. `ActiveCampaignJobIndicator.tsx`

- `autoResolveStuckJob`: antes de marcar `failed`, tentar `supabase.functions.invoke('process-campaign-job', { body: { job_id } })`. Poll `updated_at` por 90s. Flag local `recoveryAttempted[job.id]` evita re-tentativa.
- **Limitação documentada** em comentário no código e no card de release: "Recuperação automática depende do frontend aberto na empresa do job. Sem ninguém na tela após crash mid-chain, batch fica órfão até abrir a UI ou usar 'Retomar Falhas'. Recuperação server-side fora desta fase."

### 6. Notificações

Se usarmos `disparo_retomado`, registrar em `src/lib/notifications/registry.ts` (label, ícone, badge). Inserção via helper idempotente por `link`.

### 7. Callback Lambda → SagaOne (dados controlados)

- `template-paused-webhook`: `id_meta` real já em `awaiting_approval` para validar caminho do lock (`ignored_duplicate_request`).
- `reset-disparos-pendente`: par `lead_id`/`prospeccao_id` em ambiente sandbox (`EMPRESA ADMIN` quando aplicável). Cruzar efeito com `contatos.data_disparo_ia` **e** `eventos_prospeccao.data_disparo_ia`.

## Fora do escopo

- Alterar `scheduled-campaign-dispatcher`, janela 07–20, chunking, `bulk_upsert_contatos`, `upsert_quarentena`, `eventos_prospeccao`, `contato_quarentena`.
- Modificar `template-paused-webhook` ou `reset-disparos-pendente`.
- Recuperação server-side de immediate órfão (limitação aceita).
- Limitador global de cadeias concorrentes.

## Critérios de aceite

1. Parte A passa 4/4 checks para `id_meta=4420455864866490`.
2. Seleção do próximo batch e claim usam **a mesma cláusula** (`pending`/`failed` ∪ `processing > 10min`); `processing` stale tem prioridade sobre `pending` no `ORDER BY`.
3. Claim recupera batch em `processing` há >10 min (teste do "kill isolate mid-batch").
4. Job `cancelled` mid-chain não é ressuscitado e elo aborta com `reason=cancelled`.
5. Revalidação imediata usa `eventos_prospeccao.data_disparo_ia` por `(prospeccao_id, contato_id)`; contatos já disparados são pulados e contabilizados em `skipped_already_dispatched`. Sem leitura de `contatos.data_disparo_ia` no hot path.
6. View `vw_immediate_jobs_status` testada com dois usuários de empresas diferentes — cada um vê só os próprios jobs; `immediate_open` reflete a regra unificada.
7. Logs `🔗 [CHAIN]` permitem reconstruir cadeia inteira por `job_id` sem PII.
8. Limitação do `ActiveCampaignJobIndicator` documentada em código e release.
9. Teste 2.500 leads bate com 3 raiz + 7 filhos.
10. Tipo `disparo_retomado` registrado se for usado.

## Ordem de execução

```text
0. Parte A: validação read-only do template-paused
1. Testar callbacks (dados controlados)
2. Self-chain: claim + seleção (mesma cláusula, prioridade processing stale)
3. Cancel-check antes de processing
4. Revalidação por eventos_prospeccao.data_disparo_ia
5. Logs estruturados
6. View segura (security_invoker + user_can_access_empresa)
7. ActiveCampaignJobIndicator + comentário de limitação
8. Testes: 250 / 2.500 / kill isolate (processing stale) / Retomar Falhas / cancelamento / agendado intacto
```
