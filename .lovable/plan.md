# Fase 5 — Fechamento da Programação de Disparos WhatsApp

Entrega o que falta do plano em `.lovable/plan.md`: ativar o cron, expor cancelamento e a lista de disparos programados, e garantir auditoria/notificação alinhadas.

## 1. Cron `*/30 * * * *` (via `supabase--insert`)

- Habilitar `pg_cron` e `pg_net` (idempotente).
- Agendar `disparo-slots-30min` chamando `scheduled-campaign-dispatcher` com `Authorization: Bearer <anon key>` + `apikey` no header (padrão usado nos outros crons do projeto).
- Antes de criar, `cron.unschedule('disparo-slots-30min')` para garantir idempotência.
- Não vai em migration (contém anon key/URL específicas do projeto, conforme regra do plano).

## 2. Cancelamento

### 2.1 RPC `cancel_scheduled_campaign_job(p_job_id uuid)` (migration)
`SECURITY DEFINER`, `set search_path = public`. Lógica:
- Valida acesso via `user_can_access_empresa(empresa_id)` do job.
- Aborta se `status NOT IN ('scheduled','processing','partially_completed')` ou já cancelado.
- `UPDATE campaign_jobs SET status='cancelled', cancelled_at=now(), cancelled_by=auth.uid()`.
- `UPDATE campaign_batches SET status='cancelled' WHERE job_id=p_job_id AND status='scheduled'`.
- Batches `processing` terminam naturalmente (claim já foi feito, lock detém).
- Insere `logs_disparos` (`origem='edge_function'`, ação cancelamento) com `cancelled_by` e total de lotes cancelados.
- Retorna `{cancelled_batches, kept_processing}`.

### 2.2 Proteção no scheduler
`claim_due_campaign_batches` já filtra `cj.cancelled_at IS NULL` — confirmar e manter.

## 3. UI — Lista "Disparos Programados"

Novo componente `DisparosProgramadosList.tsx` exibido em `EventoBase.tsx` logo abaixo do bloco de botões, visível só quando há jobs com `dispatch_mode='scheduled'` e `status IN ('scheduled','processing','partially_completed')` para o evento.

Colunas:
- Status (badge: Agendado / Em andamento / Parcial).
- Total de leads e nº de lotes.
- Próximo lote (mín `scheduled_at` dos batches `scheduled`).
- Primeiro/último envio (min/max `scheduled_at`).
- Progresso `processed + failed + duplicate / total_records`.
- Criado por / Criado em.
- Ações: **Detalhes** (drawer com lotes), **Cancelar** (confirmação → invoca RPC).

Hook `useScheduledCampaignJobs(prospeccaoId)`:
- Query inicial + Realtime em `campaign_jobs` filtrado por `prospeccao_id`.
- Realtime em `campaign_batches` para refrescar contadores de "próximo lote".
- `useEffect` com `removeChannel` no cleanup (regra do projeto).

Drawer de detalhes:
- Lista de batches ordenada por `lot_index`: `scheduled_at`, status, `total_leads`, `retry_count`, `locked_at`.
- Sem PII de leads.

## 4. Gating de permissão

- Botão "Cancelar" exige `canProgramarCampanhas` (mesma permissão do agendar). Sem permissão → `<Lock>` disabled.
- Master/Admin/TI seguem regra atual de override.

## 5. Auditoria & notificações

- `process-campaign-job` (já ajustado na Fase 2): só dispara `notificacoes` `disparo_concluido` quando o job inteiro (todos os lotes) termina — confirmar comportamento.
- Adicionar `notificacoes` tipo `disparo_cancelado` ao final da RPC de cancelamento, para o `user_id` criador do job.
- `logs_disparos` por batch já cobre execução (origem `edge_function` com `lot_index` no metadata via Fase 2).
- Cancelamento grava 1 linha em `logs_disparos` com `origem='edge_function'`, `total_falha=0`, `total_sucesso=0`, metadata `{ action: 'cancelled', cancelled_batches }`.

## 6. Checklist de regressão (incremental)

- Agendar evento e cancelar antes do primeiro slot → todos batches `cancelled`, job `cancelled`, sem disparos.
- Cancelar com lote `processing` em voo → batch em andamento termina, demais `scheduled` viram `cancelled`, job final = `cancelled`.
- Cancelar job já `completed` → bloqueado (RPC retorna erro).
- Coexistência: agendamento ativo + disparo imediato no mesmo evento → ambos funcionam (índices distintos).
- Cron executa a cada 30 min e promove apenas batches `scheduled_at <= now()`.
- Realtime atualiza lista quando cron promove batch.
- Sem permissão `canProgramarCampanhas` → botão Cancelar travado.
- Notificação `disparo_concluido` só ao fim do job (não por lote).
- Notificação `disparo_cancelado` criada.

## 7. Ordem de execução

1. Migration: RPC `cancel_scheduled_campaign_job` + tipo de notificação se necessário.
2. `supabase--insert`: habilitar extensões + agendar cron.
3. Frontend: `useScheduledCampaignJobs`, `DisparosProgramadosList`, integração em `EventoBase.tsx`.
4. Smoke test: agendar evento pequeno, validar promoção pelo cron, cancelar, verificar logs/notificações.

## 8. Fora de escopo (mantido)

- Não alterar `bulk_upsert_contatos`, `upsert_quarentena`, `eventos_prospeccao`, batch imediato (1000), índice ativo de `campaign_jobs`.
- Sem checagem de saldo Meta.
- Sem mudança no `DispararProgressModal` do fluxo imediato.
