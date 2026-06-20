## Objetivo

Consolidar em documentação permanente o que foi implementado nesta entrega (self-chain immediate, recuperação de jobs órfãos, revalidação por `eventos_prospeccao.data_disparo_ia`, view `vw_immediate_jobs_status`, validação do fluxo de template pausado). Hoje só existe registro em `.lovable/plan.md` (execução) e comentários no código.

## Arquivos a criar/atualizar

### 1. `docs/fluxo-disparo-whatsapp.md` (atualizar)

Adicionar duas seções novas, mantendo o conteúdo existente:

- **Self-chain immediate**
  - Princípio: 1 isolate = 1 batch; ao final, `fetch` fire-and-forget para `process-campaign-job` com `x-chain-depth` incrementado (cap 100).
  - Escopo: só `lot_index IS NULL`. Scheduled continua no `scheduled-campaign-dispatcher` + janela 07–20.
  - Seleção do próximo batch e claim usam **a mesma cláusula** (`pending`/`failed` ∪ `processing > 10min`), com `ORDER BY` que prioriza `processing` stale.
  - Cancel-check (`status='cancelled'` ou `cancelled_at IS NOT NULL`) antes de marcar job `processing` e entre elos — não ressuscita.
  - Logs estruturados: `🔗 [CHAIN] start`, `🔗 [CHAIN] next-invoked`, `🔚 [CHAIN] end-of-chain reason=<no_more|cap_reached|cancelled|already_claimed|job_completed>`, `🏁 [BG] ... skipped_already_dispatched=<n>`.
- **Revalidação imediata anti-duplicidade**
  - Antes do payload da Lambda, filtrar leads do batch via `eventos_prospeccao(prospeccao_id, contato_id)` descartando `data_disparo_ia IS NOT NULL`. Sem fallback em `contatos.data_disparo_ia` (custo).
  - Contabilizado em `skipped_already_dispatched`.

### 2. `docs/recuperacao-jobs-orfaos.md` (novo)

- Cenário do "immediate órfão" (crash mid-chain).
- Recuperação primária: `ActiveCampaignJobIndicator` chama `process-campaign-job` antes de marcar `failed`; poll de `updated_at` por 90s; flag `recoveryAttempted` evita loop.
- **Limitação Opção A**: depende do frontend aberto na empresa do job. Sem ninguém na UI, batch fica órfão até abrir tela ou usar "Retomar Falhas". Recuperação server-side fora desta fase.
- Notificação `disparo_retomado` (registrada em `src/lib/notifications/registry.ts`) versus `disparo_falhou` (idempotente por `link`).
- View `vw_immediate_jobs_status` para diagnóstico (campos `vivo`/`orfao`/`concluido`, `immediate_open`).
- RPC `claim_next_immediate_batch` (security definer, service_role only) — assinatura e regra de seleção.

### 3. `docs/fluxo-template-pausado.md` (novo)

Fluxo ponta a ponta de `template-paused-webhook` (validado nesta entrega):

1. Lock atômico em `template_pausado_log` (índice único parcial em `id_meta_original` WHERE status NOT IN final).
2. `whatsapp_templates` → `status_meta='PAUSED'`.
3. 5 `TEMPLATE_FIELDS` em `prospeccoes` (whatsapp) → desassocia + `disparos_pausados=true`.
4. `campaign_jobs` pending/processing → `cancelled` com `error_message='Template pausado pela Meta'`.
5. Duplicação por empresa: `<base>_v<N+1>` + `tweakBodyText` + `trigger-webhook → novo_template_whatsapp`. Sem `template_id_pri` → rollback.
6. Log `awaiting_approval` (sucesso) / `failed`.

Inclui:
- Evidência atual (`id_meta=4420455864866490` validado).
- Lambda → SagaOne (`template_paused → template-paused-webhook`, `reset_disparos_pendente → reset-disparos-pendente`).
- Reabertura: vincular template aprovado + desmarcar `disparos_pausados` → `paused-template-resolution-logic` libera "Retomar Falhas".

### 4. Memórias (`mem://`)

Adicionar 3 entradas curtas no índice + arquivos:

- `mem://architecture/campaign-jobs/self-chain-immediate` — type `architecture`. Regra: immediate usa self-chain `process-campaign-job → fetch self`; scheduled continua no cron; cap 100; mesma cláusula em select+claim com prioridade para `processing > 10min`.
- `mem://architecture/campaign-jobs/recuperacao-orfaos-frontend` — type `constraint`. Recuperação automática depende do `ActiveCampaignJobIndicator` montado; fallback manual = "Retomar Falhas".
- `mem://features/whatsapp/revalidacao-eventos-prospeccao-imediato` — type `feature`. Gate canônico antes da Lambda é `eventos_prospeccao.data_disparo_ia` por `(prospeccao_id, contato_id)`. Não usar `contatos.data_disparo_ia` no hot path.

### 5. `.lovable/plan.md`

Marcar Parte A e Parte B como executadas; preservar critérios de aceite como referência histórica.

## Fora do escopo

- Qualquer alteração em código, edge functions, schema, RLS ou UI.
- Mexer em `scheduled-campaign-dispatcher`, `bulk_upsert_contatos`, `template-paused-webhook`.

## Critérios de aceite

1. `docs/fluxo-disparo-whatsapp.md` cita self-chain, cap 100, mesma cláusula select+claim, cancel-check, logs `🔗 [CHAIN]`, revalidação `eventos_prospeccao`.
2. `docs/recuperacao-jobs-orfaos.md` documenta limitação Opção A, RPC `claim_next_immediate_batch`, view `vw_immediate_jobs_status`, notificações.
3. `docs/fluxo-template-pausado.md` lista os 6 passos + reabertura + callbacks Lambda.
4. 3 memórias novas indexadas em `mem://index.md`.
5. `.lovable/plan.md` reflete status executado.
