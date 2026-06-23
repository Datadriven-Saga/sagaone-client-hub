## Diagnóstico — Disparos programados

### Caso Hyundai CBA (prospecção `0dc6e182…`)
- Job `23a45ad7-ea60-41ee-ade4-e21b14daa6e2`, `dispatch_mode=scheduled`, `cadence=by_lot_size`, `interval=30min`.
- 6.580 contatos / 27 lotes de 250, primeiro slot 23/06 19:00 UTC (16:00 BRT).
- Agora 20:07 UTC: 12 lotes deveriam ter rodado, **0 foram reivindicados** (`status=scheduled`, `locked_at=NULL`, `retry_count=0`). Job ainda em `scheduled`.

### Estado do sistema (13 jobs ativos)
- ~124 batches overdue acumulados; vários jobs `processing` com alguns lotes andando, outros (Hyundai, c048336d, 6ab0015a, e7a78484, 573054df, 63ddafb0) sem nenhum claim.

### Confirmado
- `cron.job` 6 = `*/30 * * * *` → 2 ticks/h. Histórico em `cron.job_run_details` mostra ticks 19:00 / 19:30 / 20:00 OK.
- `scheduled-campaign-dispatcher` chama `claim_due_campaign_batches(p_limit=10)` → no máximo **10 batches por tick** (20/h cluster-wide).
- `claim_due_campaign_batches` ordena `scheduled_at ASC, lot_index ASC NULLS LAST` → quando vários jobs caem no mesmo slot, tie-breaker é só `lot_index`. Jobs com `lot_index=0` no mesmo horário disputam aleatoriamente.
- `process-campaign-job` (self-chain) só atua **depois** que o batch é reivindicado pelo dispatcher (mode scheduled não usa self-chain, por design).
- Não há `cancelled_at`, `disparos_pausados` ativos, nem batches com erro — pipeline está saudável, só lento.

### Hipótese forte (não confirmada)
- Concentração de agendamentos no slot 19:00 UTC + cap de 10/tick → fila gigante e jobs "perdedores" do tie-breaker ficam pra trás indefinidamente enquanto novos jobs do mesmo slot chegam.

### Descartado
- Bug de visibilidade no front. `useScheduledCampaignJobs` lê fielmente `campaign_jobs`+`campaign_batches`; o que o usuário vê é o estado real.
- Cron parado / dispatcher quebrado.
- Janela 07–20 BRT bloqueando (19:00 UTC = 16:00 BRT, dentro da janela).

---

## Correção proposta (em camadas, reversível)

### Camada 1 — Observabilidade (sem risco)
- Adicionar no `scheduled-campaign-dispatcher`: log estruturado por tick com `claimed`, `dispatched`, `tick_ts`, e — antes do claim — `SELECT count(*) FROM campaign_batches WHERE status='scheduled' AND scheduled_at <= now()` (backlog total). Permite ver fila ao vivo nos logs.
- Painel rápido (RPC) `get_dispatcher_backlog()` → `{overdue_total, jobs_overdue, oldest_scheduled_at}` consumido em `/administracao/visao-geral` ou em um card no detalhe da prospecção.

### Camada 2 — Aumento de throughput (reversível por config)
- Subir `p_limit` do dispatcher de **10 → 50** por tick.
- Encurtar cron de `*/30` para **`*/5 * * * *`** (12 ticks/h). Resultado: ~600 batches/h teóricos vs 20 atuais. Mantém `FOR UPDATE SKIP LOCKED` que já evita disputa entre ticks.
- Justificativa de segurança: `process-campaign-job` é fire-and-forget HTTP, cada batch é uma Edge isolate independente; subir vazão do dispatcher não muda contrato com WhatsApp (rate-limit interno de 5 req/500ms já existe por batch).

### Camada 3 — Fairness entre jobs (SQL pequeno em `claim_due_campaign_batches`)
- Mudar `ORDER BY scheduled_at ASC, lot_index ASC NULLS LAST` para incluir um round-robin por `job_id` usando `ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY scheduled_at, lot_index)` como primeiro critério. Garante que cada tick pega no máximo N lotes por job antes de passar pro próximo.
- Mantém `FOR UPDATE SKIP LOCKED` e `SECURITY DEFINER`.

### Camada 4 — Recuperação imediata do backlog atual (one-shot)
- Disparo manual do dispatcher em loop curto (ex.: invocar a edge 5–10 vezes seguidas) **depois** que p_limit estiver maior, pra zerar os ~124 lotes overdue sem esperar o próximo tick.
- Alternativa: ad-hoc `SELECT claim_due_campaign_batches(100, 'manual-catchup')` no SQL editor + invocar `process-campaign-job` por batch retornado. Não recomendado sem a Camada 2 aplicada antes.

---

## O que NÃO alterar
- `process-campaign-job` (self-chain immediate, contrato WhatsApp, rate-limit interno).
- `bulk_upsert_contatos`, `upsert_quarentena`, `contato_quarentena` — fora do escopo.
- Janela 07–20 BRT no dispatcher (regra de negócio).
- `dispatch-leads-webhook` e `logs_disparos` server-side.
- Layout do modal "Lotes programados" no front (já mostra o estado real corretamente).

## Testes obrigatórios antes de marcar como resolvido
1. Após Camada 2: aguardar 1 tick e confirmar `claimed > 10` nos logs do `scheduled-campaign-dispatcher`.
2. Backlog: `SELECT count(*) FROM campaign_batches WHERE status='scheduled' AND scheduled_at<=now()` cai consistentemente entre ticks.
3. Job Hyundai `23a45ad7`: lotes 0 e 1 viram `processing` → `completed`, `processed_records` sobe, `logs_disparos` ganha linhas com `origem='edge_function'` e `job_id=23a45ad7…`.
4. Sem regressão em immediate (jobs `dispatch_mode='immediate'` continuam usando self-chain e não passam pelo dispatcher).
5. Verificar `template_pausado_audit` e `logs_disparos_falhas` não acumulam falhas novas após catch-up.

## Próximo passo
Aprovar o plano para eu aplicar Camadas 1 + 2 + 3 (migração da RPC, edit do `scheduled-campaign-dispatcher`, update da `cron.job` 6). Camada 4 (catch-up) eu rodo logo depois, com você acompanhando os logs.
