
# Diagnóstico — disparo manual travado em 339/496

**Job:** `2fc0275b-11e6-4ec4-ab04-04bdedad8e7b` · prospecção `52b26b79…` · BYD Park Sul · `dispatch_mode = immediate`

## Linha do tempo real

```text
17:19:48,7  campaign_jobs criado (total=496, status=pending)
17:19:48,7  campaign_batches criado — 1 ÚNICO batch, batch_index=0, total_leads=496
17:19:49,4  batch started_at
17:20:36,8  última gravação em logs_disparos_falhas (1 numero_invalido)
17:22       pico de invocações na Lambda (~110/min) — job rodando normal
17:25-17:26 invocações da Lambda caem para ~30/min → edge parou de chamar
17:49:04,1  ActiveCampaignJobIndicator força "completed"
            → "Finalizado automaticamente (sem atividade por 10+ min). 339/496 processados."
```

Estado final: `processed_records=339`, `failed_records=1`, `duplicate=0`. **156 leads nunca foram tentados**. Nenhuma linha em `logs_disparos` (a auditoria por batch só grava no final do batch). Nenhum log na Edge Function `process-campaign-job` no Supabase (analytics_query vazio na janela).

## Caminho real

```text
EventoBase.tsx
  → invoke('process-campaign-job', { job_id })
    → EdgeRuntime.waitUntil(processPromise)   ← background isolate
       → loop WhatsApp: WA_BATCH_SIZE=5, delay 500ms entre sub-lotes
          → fetch(Lambda)  timeout 30s, Promise.allSettled em rajadas de 5
```

Disparo **manual** (`immediate`) vai num único `campaign_batches` com todos os 496 leads — não tem `scheduled_at`/`lot_index` (esses são só para programado).

## Causa raiz (Confirmado)

1. **Lote único de 496 num modo sem chunking.** 100 sub-lotes × (500ms + ~5s avg de latência Lambda) = **~550s ≈ 9 min** de execução estimada.
2. **Lambda estava saudável** (gráficos: avg 5s, max 47s, sem espigão de erro), com invocações decrescentes a partir de 17:23 e quebra clara em 17:25–17:26 — exatamente onde o trabalho parou.
3. **O isolate de background da Edge Function tem teto de wall-clock** (~150s CPU / ~400s wall em waitUntil). Após ~5–6 min o isolate é morto sem flushar nada: o batch fica em `processing`, o job em `pending/processing` com `updated_at` congelado, e os 156 leads restantes seguem em `lead_ids` sem retry.
4. **`ActiveCampaignJobIndicator`** (`STUCK_THRESHOLD_MS = 10*60*1000`) detecta `updated_at` parado >10 min e força `completed`/`failed` no frontend. É um safety net, não recupera leads.

**Descartado** com evidência:
- Lambda lenta/instável: métricas mostram saúde.
- Rede/falha em massa: 1 só falha real (numero_invalido).
- Cron `scheduled-campaign-dispatcher`: job é `immediate`, sem `scheduled_at`.
- RLS/permissão: 339 leads foram gravados com sucesso antes da morte.

## Por que o disparo programado não tem esse bug

O `ProgramarDisparoModal` já quebra em lotes via `lot_index` + `scheduled_at`; cada lote vira uma nova invocação independente do `scheduled-campaign-dispatcher`, então cada isolate enfrenta no máximo o tamanho de 1 lote.

O caminho **manual nunca recebeu esse mesmo cuidado**.

---

# Plano de correção em camadas

## Camada 1 — Observabilidade

`process-campaign-job`: adicionar `console.log` final no fim do background com `{job_id, leads_no_batch, leads_processados, duration_ms}` para que, da próxima vez que o isolate morrer, a fronteira do corte fique visível nos logs (hoje só logamos progresso a cada 20 sub-lotes).

## Camada 2 — Mitigação (foco)

**Aplicar chunking server-side no modo `immediate`, reusando o caminho do `scheduled-campaign-dispatcher`.** Sem mexer em frontend, sem nova RPC, sem tocar em `bulk_upsert_contatos`.

Em `process-campaign-job/index.ts`, logo após carregar `batch` + `leads` (antes do loop WhatsApp, e apenas quando `!isIALigacao`):

```text
const MAX_LEADS_PER_BATCH = 250   // alvo: ≤ 4 min de execução
if (leads.length > MAX_LEADS_PER_BATCH) {
  1. Manter no batch atual apenas os primeiros 250 lead_ids
     UPDATE campaign_batches
        SET lead_ids = lead_ids[1:250], total_leads = 250
      WHERE id = batch.id
  2. Inserir N novos campaign_batches com os chunks restantes:
        job_id, batch_index = batch_index + i,
        status = 'scheduled',
        scheduled_at = now() + (i * 30s),     -- escalonado p/ não estourar o cron
        lot_index = (batch_index + i),
        lead_ids = chunk[i],
        total_leads = chunk[i].length
  3. Continuar o processamento normal do batch atual (250 leads).
}
```

Por que `status='scheduled'` e não self-chain:
- O `scheduled-campaign-dispatcher` já roda a cada minuto, já reivindica batches via `claim_due_campaign_batches`, já invoca `process-campaign-job` por lote, já tem a proteção de janela 07–22 que acabamos de implementar.
- Reaproveita caminho exercitado diariamente; não cria nova surface de bug.
- Custo: latência adicional de até ~1min entre lotes (aceitável; usuário já fecha o modal e deixa rodar).

`isIALigacao` fica fora desta entrega — usa `prospect_pri_voz`, comportamento diferente, e não há relato de travamento nesse pipeline.

## Camada 3 — Recuperação dos 156 leads atuais

Sem migração SQL. O usuário pode:

1. Recarregar o evento → "Pendentes IA" volta a mostrar os 156 não-disparados.
2. Clicar "Disparar WhatsApp" novamente → novo `campaign_jobs` que agora cai no chunking.

## Camada 4 — NÃO mexer agora

- `bulk_upsert_contatos`, `contato_quarentena`, `eventos_prospeccao`.
- `STUCK_THRESHOLD_MS` no frontend (continua sendo o safety net).
- `WA_BATCH_SIZE`/`WA_DELAY_MS` (calibrados para a Lambda).
- Janela 07–22 (já tratada em iteração anterior).

---

# Arquivos a alterar

- `supabase/functions/process-campaign-job/index.ts` — adicionar bloco de chunking server-side antes do loop WhatsApp; log final do background.
- `docs/fluxo-disparo-whatsapp.md` — registrar na seção de disparo imediato que lotes >250 são automaticamente fragmentados em batches `scheduled` reaproveitando o cron.

# Testes obrigatórios

1. Disparo manual com 50 leads → 1 batch, comportamento idêntico.
2. Disparo manual com 600 leads → batch original com 250; 2 batches `scheduled` (250 e 100) reivindicados em sequência pelo cron; total `processed_records=600`, batch original `completed`, demais `completed`.
3. Disparo programado existente → não pode ser re-fragmentado (já vem com `lot_index` definido; chunking só dispara quando `lot_index IS NULL` ou quando o batch é o primeiro e único).
4. Disparo manual fora da janela 07–22 → primeiro batch roda imediato; os filhos com `scheduled_at` no futuro respeitam o reagendamento já implementado no dispatcher.
5. Reexecutar disparo no evento BYD Park Sul para limpar os 156 pendentes.

# Risco

Baixo. Cada peça (criação de batch `scheduled`, claim pelo dispatcher, processamento de batch único) já é exercitada hoje pelo disparo programado.

Skill usada: `deep-root-cause-analysis-db-first`.
