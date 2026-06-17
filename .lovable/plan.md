# Registro — alteracoes recentes no disparo WhatsApp

Duas alteracoes ja implementadas e deployadas no fluxo de disparo WhatsApp.

## 1. Chunking server-side para disparo imediato (concluido)

**Problema:** o isolate de background da Edge Function (`EdgeRuntime.waitUntil`) tem teto de wall-clock (~5–6 min). Um unico batch grande (ex.: 496 leads × ~5 s/lead × sub-lotes de 5 a cada 500 ms ≈ 9 min) era morto silenciosamente, deixando o batch em `processing`, `updated_at` congelado e os leads restantes sem retry. O `ActiveCampaignJobIndicator` forcava `completed`/`failed` apos 10 min, mas nao recuperava os leads.

**Mitigacao** (em `supabase/functions/process-campaign-job/index.ts`, aplicada apenas quando `lot_index IS NULL`):

- `MAX_LEADS_PER_BATCH = 250` e `STAGGER_MS = 30_000`.
- Apos carregar `leads` e aplicar a revalidacao `data_disparo_ia`, se `leads.length > 250`:
  1. Batch atual encolhido para os primeiros 250 (`UPDATE lead_ids, total_leads`).
  2. Excedentes viram N novos `campaign_batches` com `status='scheduled'`, `lot_index` definido, `batch_index` sequencial e `scheduled_at = now() + (i+1)*30s`.
  3. `scheduled-campaign-dispatcher` (cron 1 min) reivindica e processa cada filho — incluindo respeito a janela 07–20.
- Guarda `lot_index IS NULL` impede que filhos (que ja tem `lot_index`) reentrem no chunking.
- Se o INSERT dos filhos falhar, o batch original e revertido para os leads completos.
- Log final por batch: `🏁 [BG] Batch <idx> finalizado: status=..., leads_no_batch=..., sucesso=..., falha=..., duplicate=..., duration_ms=...`.

IA Ligacao fora de escopo (latencia menor, sem relato de travamento).

## 2. Janela de disparo reduzida de 07–22 para 07–20 (concluido)

**`src/components/ProgramarDisparoModal.tsx`:** `JANELA_FIM_H = 20`; mensagens atualizadas para `07:00–20:00`. `buildSlots` e `isWithinWindow` derivam da constante — ultimo slot e 20:00, `20:30+` bloqueado.

**`supabase/functions/scheduled-campaign-dispatcher/index.ts`:** `WINDOW_END_H = 20`. Batches reivindicados apos 20:00 sao silenciosamente reagendados para 07:00 do dia seguinte (`locked_at`/`locked_by` limpos), sem disparar a Lambda nem notificar.

**`docs/fluxo-disparo-whatsapp.md`:** todas as mencoes a janela atualizadas para `07–20` / `07:00–20:00` / `20:00`.

`WINDOW_START_H = 07` inalterado. Cron continua rodando 24h — edge enforce a janela. Jobs ja agendados entre 20:01 e 22:00 sao reagendados automaticamente ao serem reivindicados.

## Verificacao

- [x] UI bloqueia programacao em 20:30; aceita 20:00.
- [x] Batch com `scheduled_at = 21:00` e reagendado para 07:00 do dia seguinte pelo dispatcher.
- [ ] Disparo imediato com 50 leads → 1 batch unico, sem chunking.
- [ ] Disparo imediato com 600 leads → batch original reduzido a 250 + 2 batches `scheduled` (250 e 100) reivindicados pelo cron; somatorio `processed_records=600`.
- [ ] Disparo imediato fora da janela 07–20 → primeiro batch roda imediato; filhos com `scheduled_at` futuro respeitam o reagendamento do dispatcher.
