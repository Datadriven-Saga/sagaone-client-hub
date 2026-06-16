# Programação e Cadência de Disparos WhatsApp

Base: fluxo imediato em `/prospeccao/eventos/:id/base` (`EventoBase.tsx`, `process-campaign-job`, `DispararProgressModal`, `DispararCustoModal`), índice único atual `(empresa_id, prospeccao_id) WHERE status IN ('pending','processing')`, e diagnóstico FIAT SIA (statement_timeout 8s, cauda longa).

---

## 0. Decisões consolidadas

| Tema | Decisão |
|---|---|
| Slots | 30 em 30 min; cron `*/30 * * * *` |
| Janela | 07:00–22:00 America/Sao_Paulo (explícito na UI) |
| Base congelada | Sim, via `lead_ids` no momento do agendamento (comportamento atual) |
| Batch técnico (agendado) | 250 (reduz blast radius e exposição à cauda) |
| Imediato | Mantém 1.000 — não alterar |
| Saldo/billing Meta | Fora de escopo |
| Contadores | RPC atômica obrigatória |
| Lock de batch | Compare-and-swap `UPDATE...RETURNING` obrigatório |
| Cron | `pg_cron` + `pg_net` (já em uso) |
| Cancelamento | Cancela `scheduled`; `processing` termina |
| Retomar falhas | Imediato (reusa fluxo atual) |
| Permissão | `canProgramarCampanhas` (já existe) |

---

## 1. Banco (Fase 1)

### 1.1 `campaign_jobs`
Adicionar: `dispatch_mode` (`immediate`|`scheduled`, default `immediate`), `timezone` (default `America/Sao_Paulo`), `cadence_type` (`none`|`by_lot_count`|`by_lot_size`), `interval_minutes`, `first_scheduled_at`, `cancelled_at`, `cancelled_by`.
Status passa a aceitar: `scheduled`, `partially_completed`, `cancelled`.

### 1.2 `campaign_batches`
Adicionar: `scheduled_at` (NULL = imediato), `lot_index`, `locked_at`, `locked_by`.
Status passa a aceitar `scheduled`.
**NÃO alterar `lead_ids`** — segue sendo o array congelado.

### 1.3 Índices
- `idx_campaign_batches_scheduled_due` parcial em `(scheduled_at) WHERE status='scheduled'`.
- **NÃO mexer** em `uq_campaign_jobs_active_per_prospeccao` (mantém `pending`/`processing`).
- **Adicionar** `uq_campaign_jobs_scheduled_slot (empresa_id, prospeccao_id, first_scheduled_at) WHERE status='scheduled'`.

Coexistência scheduled + imediato é intencional. Quando cron promove `scheduled`→`processing`, entra no índice ativo existente e bloqueia concorrentes naturalmente.

### 1.4 RPC `claim_due_campaign_batches(p_limit, p_worker_id)`
`SECURITY DEFINER`, `set search_path = public`. Faz CTE com `FOR UPDATE SKIP LOCKED`, filtra:
- `cb.status='scheduled' AND cb.scheduled_at <= now()`
- `cj.status IN ('scheduled','processing','partially_completed')` e `cj.cancelled_at IS NULL`
- `prospeccoes.disparos_pausados = false`
Em seguida `UPDATE ... SET status='processing', locked_at=now(), locked_by=p_worker_id RETURNING *`.

### 1.5 RPC `increment_job_counters(p_job_id, p_processed, p_failed, p_duplicate)`
`SECURITY DEFINER`. `UPDATE campaign_jobs SET processed_records = coalesce(...)+p_processed, ...`. Substitui o read-modify-write em memória, que só funciona hoje porque o índice único garante um worker por job.

---

## 2. `process-campaign-job` (Fase 2)

Mudanças cirúrgicas, mantendo invocação `{ job_id }` 100% compatível:

1. Payload aceita `{ job_id, batch_id? }`. Com `batch_id`, filtra `.eq('id', batch_id)`.
2. Sem `batch_id`: continua processando só `pending`/`failed` — **nunca** varre `scheduled`.
3. Quando vier do cron, o batch já chega `processing` via `claim_due_campaign_batches`. Abortar se estado inesperado.
4. Substituir contadores in-memory por `increment_job_counters`.
5. Regra de conclusão do job:
   - Existe batch `scheduled` → não mexe no status do job.
   - Todos terminais → `completed`; se houve falha → `partially_completed`.
   - Job imediato (sem `scheduled`) mantém comportamento atual + "Forçar Finalização" 10 min.
6. Chunk interno 250 para batches `dispatch_mode='scheduled'`. Imediato mantém 1.000. `5 req / 500ms` e timeout 30s/lead permanecem.
7. `notificacoes` (`disparo_concluido`) só ao fim do job inteiro.

---

## 3. Scheduler (Fase 3)

Edge `scheduled-campaign-dispatcher`:
1. `claim_due_campaign_batches(p_limit := 10, p_worker_id := 'cron')`.
2. Para cada batch retornado, invoca `process-campaign-job` com `{ job_id, batch_id }` em fire-and-forget.
3. Excedente fica `scheduled` e entra no próximo tick.

Cron via `pg_cron` + `pg_net` (inserir via supabase--insert, não migration, pois contém anon key/URL):

```text
*/30 * * * *  →  net.http_post(<edge URL>)
```

`scheduled_at <= now()` (timestamptz) é imune a skew/atraso do cron.

---

## 4. UI (Fase 4)

### 4.1 `EventoBase.tsx`
Novo botão **"Programar WhatsApp"** ao lado de "Disparar WhatsApp (N)". Gate: `canProgramarCampanhas && !disparos_pausados`. Sem permissão renderiza `<Lock>` disabled.

### 4.2 `ProgramarDisparoModal`
- Data do primeiro envio.
- Dropdown de horários em slots de 30 min, **limitado 07:00–22:00**.
- Aviso fixo: "Os horários estão no fuso de Brasília (GMT-3)."
- Modo: tudo de uma vez / N lotes / lotes de X contatos.
- Intervalo entre lotes: múltiplos de 30 min.
- Resumo: total, nº lotes, primeiro/último envio, custo estimado.

Validações:
- Mínimo: próximo slot futuro.
- Todos os lotes calculados dentro da janela 07:00–22:00; senão bloqueia.
- N lotes ≤ total; tamanho > 0.
- Teto por lote de negócio: 5.000 (chunk interno 250).

### 4.3 Custo
Reutilizar `DispararCustoModal` com texto ajustado. Sem validação de saldo.

### 4.4 `handleProgramarDisparoIA`
- Grava `logs_disparos` (intenção) com metadata de agendamento.
- Cria `campaign_jobs` com `dispatch_mode='scheduled'`, `status='scheduled'`, timezone, cadence, intervalo, `first_scheduled_at`.
- Resolve base agora, divide em lotes de negócio.
- Cada lote → `campaign_batches` com `lead_ids` congelados, `lot_index`, `scheduled_at = first_scheduled_at + lot_index*interval_minutes`, `status='scheduled'`.
- **Não** invoca `process-campaign-job` — o cron cuida.

### 4.5 Lista "Disparos programados"
Status, total, lotes, próximo lote, primeiro/último envio, progresso. Ações: detalhes, cancelar.

---

## 5. Cancelamento, falhas, auditoria (Fase 5)

- Cancelar: job → `cancelled` + `cancelled_at/by`; batches `scheduled` → `cancelled`; `processing` termina; `completed` permanece.
- Retomar falhas: reusa botão atual.
- Auditoria: `logs_disparos` `origem='edge_function'` por batch com `lot_index` + `scheduled_at` no metadata. Notificação ao fim do job.

---

## 6. O que NÃO alterar

1. `uq_campaign_jobs_active_per_prospeccao` (mantém pending/processing).
2. Batch size do imediato (mantém 1.000); parametrizar por `dispatch_mode`, não trocar constante global.
3. Busca default sem `batch_id` ignora `scheduled`.
4. "Forçar Finalização" 10 min — ignora/limpa `locked_at`.
5. Lock não pode bloquear re-lock de `failed` (Retomar Falhas).
6. `DispararProgressModal` Realtime do imediato intacto.
7. `lead_ids` como fonte de verdade — sem tabela de vínculo.
8. **NÃO tocar**: `bulk_upsert_contatos`, `upsert_quarentena`, `contato_quarentena`, schema/triggers de `eventos_prospeccao`. Sem PII em novos logs.

---

## 7. Checklist de regressão

Rodar **integralmente** o checklist atual do disparo imediato antes e depois de mexer no `process-campaign-job` (template ativo, `disparos_pausados`+auto-release, personalizado, >batch, permissão Lock, "disparo repetido"→duplicate, timeout 30s→retry, fechar/reabrir modal, travado>10min, Retomar Falhas, logs/falhas populados, `data_disparo_ia`, notificações).

Cenários novos:
- Coexistência scheduled + imediato mesmo evento
- Agendamento duplicado no mesmo slot bloqueado
- Cron promove `scheduled`→`processing` e bloqueia concorrentes
- Cancelar pendentes mantendo concluídos
- Contadores corretos com lotes paralelos
- Lote fora da janela bloqueado no modal

---

## 8. Ordem de execução

| Fase | Entrega |
|---|---|
| 1 | Migração: colunas + índices + RPCs `claim_due_campaign_batches` e `increment_job_counters` |
| 2 | `process-campaign-job`: `batch_id`, lock, incremento atômico, regra de conclusão, chunk 250, batch size por modo |
| 3 | Edge `scheduled-campaign-dispatcher` + cron `*/30 * * * *` (via supabase--insert) |
| 4 | UI: botão, `ProgramarDisparoModal`, `handleProgramarDisparoIA`, lista |
| 5 | Cancelamento, retomar falhas, notificações, auditoria |

---

## 9. Pendência para produto

Confirmar: permitir coexistência "agendamento futuro + disparo manual imediato no mesmo evento"? Tecnicamente seguro (índice atual permite). Se "não", incluir `'scheduled'` no índice ativo — porém isso bloquearia disparo imediato enquanto houver agendamento pendente.