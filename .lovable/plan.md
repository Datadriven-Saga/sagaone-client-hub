## Resposta direta

**Hoje os disparos agendados NÃO são impactados pela pausa do template.** O webhook só cancela jobs em `pending`/`processing`. Jobs `scheduled` ficam vivos e, quando o lote dispara, encontra `template_prospeccao_id = NULL` (foi desassociado no STEP 3) e cai em erro lote a lote.

### Evidência

Em `supabase/functions/template-paused-webhook/index.ts` (STEP 4, linhas 421-439):

```ts
.in('status', ['pending', 'processing'])   // <- 'scheduled' fica de fora
```

Caso real no banco agora:

- Job `63ddafb0-f26c-469b-bbb8-14cc4a91c4e7`
- Prospecção `de7e78f6-…` — "Feirão da copa grupo saga" — **GM VGD / GM**
- `dispatch_mode = scheduled`, `status = scheduled`, 5.621 leads, cadência `by_lot_count` a cada 30 min, 24 lotes
- `disparos_pausados = true`, `template_prospeccao_id = NULL` (templates foram desassociados pelo webhook)
- Lotes hoje: 4 completed, 6 processing, **14 failed** — exatamente o sintoma de lote disparando sem template.

## Plano de correção

### Escopo

Webhook `template-paused-webhook` passa a tratar agendados da mesma forma que immediates: cancelar job + lotes futuros e notificar o dono.

### Mudança em `supabase/functions/template-paused-webhook/index.ts` (STEP 4)

1. Ampliar a query de jobs ativos para incluir o ciclo de vida dos agendados:
   ```ts
   .in('status', ['pending', 'processing', 'scheduled', 'partially_completed'])
   ```
2. Para os jobs encontrados:
   - `UPDATE campaign_jobs SET status='cancelled', cancelled_at=now(), cancelled_by='template-paused-webhook', error_message='Template pausado pela Meta'`.
   - `UPDATE campaign_batches SET status='cancelled', error_log='Template pausado pela Meta' WHERE job_id IN (...) AND status IN ('scheduled','pending','processing')` (lotes `completed`/`failed` não são tocados).
3. Inserir `notificacoes` para o `user_id` de cada job cancelado (tipo `disparo_cancelado_template_pausado`), com link para a prospecção, para o operador saber que precisa religar o disparo após o novo template ser aprovado.
4. Logar contagem de jobs/batches cancelados no `console.log` (já existe padrão na função).

### Limpeza imediata do caso GM VGD

No mesmo deploy, migration única que aplica a regra ao job órfão `63ddafb0-…`:

- `campaign_jobs` → cancelled com `error_message='Template pausado pela Meta (limpeza retroativa)'`.
- `campaign_batches scheduled/pending/processing` → cancelled.
- 1 notificação para o `user_id` do job.

### Documentação

Atualizar `docs/fluxo-template-pausado.md` (STEP 4) e a memória `mem://architecture/whatsapp/template-pausado-audit` (ou criar `mem://features/whatsapp/pause-cancela-agendados`) registrando que pausa também cancela agendados e lotes futuros.

### O que NÃO alterar

- STEP 1 (lock atômico em `template_pausado_log`).
- STEP 2 (`whatsapp_templates.status_meta='PAUSED'`).
- STEP 3 (desassociação dos `template_*_id` e `disparos_pausados=true`).
- STEP 5 (duplicação do template).
- `scheduled-campaign-dispatcher` e `process-campaign-job` (gate server-side de `disparos_pausados` segue como está).
- Lotes já `completed` ou `failed`.

### Testes obrigatórios

1. Pausar template de teste vinculado a um job `scheduled` com lotes futuros → job vai a `cancelled`, lotes futuros vão a `cancelled`, lotes passados intactos, notificação criada.
2. Pausar template vinculado a job `processing` (caso atual) → comportamento atual preservado.
3. Pausar template sem nenhum job ativo → segue caminho normal até STEP 5.
4. Reenvio idempotente do webhook (`ignored_duplicate_request`) → não cancela duas vezes.
5. Validar no front (`DisparosProgramadosList` / `useScheduledCampaignJobs`) que job cancelado some da lista ativa.

### Próximo passo

Aprovar o plano para eu implementar a alteração do webhook + migration de limpeza do job GM VGD + atualização do `docs/fluxo-template-pausado.md`.
