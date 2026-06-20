# Fluxo de Disparo de WhatsApp — `/prospeccao/eventos/:id/base`

Documento técnico do caminho completo do botão **"Disparar WhatsApp"** até a entrega na Lambda externa, incluindo persistência, auditoria e progresso em tempo real.

> Fonte: varredura em `src/pages/prospeccao/EventoBase.tsx`, `src/components/DispararCustoModal.tsx`, `src/components/DispararProgressModal.tsx`, `supabase/functions/process-campaign-job/index.ts`, `supabase/functions/dispatch-leads-webhook/index.ts`, `supabase/functions/external-webhook-proxy/index.ts`.

---

## TL;DR

1. Usuário clica **"Disparar WhatsApp (N)"** em `EventoBase.tsx`.
2. Abre `DispararCustoModal` → mostra custo estimado em USD/BRL e grava 1 linha em `logs_disparos` (origem implícita frontend) como auditoria de intenção.
3. Cliente cria **1 `campaign_jobs`** + **N `campaign_batches`** (1 000 leads por batch) e dispara `process-campaign-job` em **fire-and-forget**.
4. Edge function processa em `EdgeRuntime.waitUntil` (background real), chamando a Lambda AWS em sub-batches de **5 requisições / 500 ms**, com timeout de 30 s por lead.
5. Após cada sub-batch grava `data_disparo_ia` em `contatos` + `eventos_prospeccao`, insere falhas em `logs_disparos_falhas` e atualiza contadores em `campaign_jobs`.
6. `DispararProgressModal` assina Realtime em `campaign_jobs` e exibe progresso ao vivo (e agregado de falhas a cada 5 s).
7. Ao fim: 1 linha em `logs_disparos` por batch (origem `edge_function`) + notificação em `notificacoes`.

---

## 1. Entrada na UI

**Rota / Página**: `src/pages/prospeccao/EventoBase.tsx:103` (`useParams` lê `eventoId`).

### Botões de disparo

| Botão | Linha | Handler | Ação |
|---|---|---|---|
| **Disparar WhatsApp (pendentes)** | `:2426-2452` | `handleDispararTodos` (`:1582`) | `setCustoModal({ isOpen: true })` |
| **Disparar X personalizado** | `:2478-2491` | `handleDispararPersonalizado` (`:1609`) | Idem, passando `quantidade` |

### Gating de permissão

```ts
// EventoBase.tsx:1961
const canDispatchWhatsApp = permissions.canDispararEventos ?? false;
const canDispatch = isIAWhatsApp ? canDispatchWhatsApp : (isIALigacao ? canDispatchLigacao : false);
```
Sem permissão o botão renderiza com `<Lock>` e `disabled`.

### Trava `disparos_pausados`

- `prospeccoes.disparos_pausados = true` força `disabled` (`:2430`).
- Em `fetchProspeccao` (`:462-480`) há **auto-release**: se a pausa foi causada por template PAUSED e existe template válido, faz `UPDATE prospeccoes SET disparos_pausados=false` e notifica via `external-webhook-proxy` (`"acao":"alterado"`).
- UI também permite troca manual de template via `handleReplaceTemplate` (`:517-560`), que limpa a pausa.

### Modais envolvidos

| Modal | Papel |
|---|---|
| `DispararCustoModal` | Confirmação com custo USD/BRL; grava `logs_disparos` antes do disparo. |
| `DispararProgressModal` | Acompanhamento Realtime do job; retry e força-finalização. |
| `SimulacaoPriWhatsAppModal` | **Não participa** do fluxo; é apenas calculadora de funil/custo. |

---

## 2. Validações pré-disparo

| Validação | Onde | Comportamento |
|---|---|---|
| `template_prospeccao_id` presente | `process-campaign-job:149-162` e `dispatch-leads-webhook:364-375` | HTTP 400 se nulo |
| Template `ativo = true` | `process-campaign-job:149-162` | Falha o job |
| Status `PAUSED` no Meta | `EventoBase.tsx:462-480` | Trava `disparos_pausados`; libera via auto-release ou substituição manual |
| `event_id_pri` | **Não exigido para WhatsApp** (só Ligação, `:1255`) | — |
| Opt-out global / quarentena | **Não checado no client nem no edge** | Delegado à Lambda (retorna `"disparo repetido"` para duplicatas) — ver "Lacunas" |

---

## 3. Criação do Job (lado cliente)

`handleDispararIA` em `EventoBase.tsx:1492-1554`:

```ts
// 1. Cria o job
const { data: job } = await supabase.from('campaign_jobs').insert({
  prospeccao_id, empresa_id, user_id,
  canal, total_records, quantidade_solicitada,
  status: 'pending'
}).select('id').single();

// 2. Cria N batches (JOB_BATCH_SIZE = 1000)
for (let i = 0; i < total; i += 1000) {
  batchInserts.push({
    job_id: job.id, batch_index: i / 1000,
    total_leads: slice.length,
    lead_ids: slice.map(l => l.id),
    status: 'pending'
  });
}
await supabase.from('campaign_batches').insert(batchInserts);

// 3. Fire-and-forget — UI não aguarda
supabase.functions.invoke('process-campaign-job', { body: { job_id } }).catch(() => {});

// 4. Abre o modal de progresso imediatamente
setActiveJobId(jobId); setShowProgressModal(true);
```

> `useActiveCampaignJob` documenta um índice único `(empresa_id, prospeccao_id)` para impedir 2 jobs ativos simultâneos por evento.

---

## 4. Edge Function `process-campaign-job`

Arquivo: `supabase/functions/process-campaign-job/index.ts`

### Handler HTTP (`:753-853`)

1. Valida JWT (service role ou usuário autenticado).
2. Atualiza `campaign_jobs.status = 'processing'`.
3. Dispara `processJobInBackground` via `EdgeRuntime.waitUntil` (background real, não conta no tempo da resposta).
4. Retorna **HTTP 202** imediatamente.

### `processJobInBackground` (`:70-748`)

Carrega contexto: `prospeccoes`, `empresas` (crm_id, marca, UF, cidade), `profiles + auth.admin` (auditoria), telefone do agente IA via `agente_empresas` + `agentes_ia` (matching `"pri"+"whatsapp"`), template + `variable_mapping`, e batches `pending`/`failed` ordenados.

### Loop WhatsApp (`:452-578`)

```text
const WA_BATCH_SIZE = 5;     // requisições por sub-batch
const WA_DELAY_MS  = 500;    // espera entre sub-batches
const TIMEOUT_MS   = 30_000; // AbortController por lead
```

- `Promise.allSettled` por sub-batch.
- **URL externa**: `https://ccnv217nqk.execute-api.us-east-1.amazonaws.com/dev/disparo` (AWS API Gateway → Lambda).
- **Header**: `x-api-key: MAIP_MSG_Wpp_Send_Dev_X_api_key` (segredo).
- Sem ir pelo `external-webhook-proxy` — comentário no código cita evitar 401 inter-function JWT.

#### Classificação da resposta

| Sinal | Categoria | Conta como |
|---|---|---|
| 2xx + body não vazio sem keyword de erro | sucesso | `processed_records++` |
| Body contém `"disparo repetido"` | `duplicate` | `duplicate_records++` (não é falha; `data_disparo_ia` é gravado) |
| Body contém `"workflow not found"` / `"not active"` | `workflow_inactive` | `failed_records++` |
| HTTP 4xx/5xx | `http_error` | `failed_records++` |
| `AbortError` (30 s) | `timeout` | `failed_records++` |
| Erro de rede | `network` | `failed_records++` |
| Body vazio | `empty_body` | `failed_records++` |
| Outro | `outro` | `failed_records++` |

#### `flushSubBatch` (`:315-332`)

Após cada sub-batch:
1. `UPDATE contatos SET data_disparo_ia=now()` para sucessos + duplicatas (em chunks de 200).
2. Idem em `eventos_prospeccao`.
3. `INSERT` bulk em `logs_disparos_falhas` (uma linha por falha com `categoria`, `mensagem`, `http_status`).
4. `UPDATE campaign_jobs` (granular) com `processed_records`, `failed_records`, `duplicate_records`, `updated_at` → dispara Realtime.

### Retries

- `MAX_RETRIES = 3` por batch (`campaign_batches.retry_count`).
- Após todos os batches: se algum ainda falhou com `retry_count >= 3` → `status='failed'`; senão `'completed'`.
- Retry manual via botão "Retomar Falhas" no modal (`onRetry` → `handleRetryJob` em `EventoBase.tsx:1411`) re-invoca a mesma função com mesmo `job_id`.

### Chunking server-side (disparo imediato)

O isolate de background da Edge Function tem teto de wall-clock (~5–6 min em `EdgeRuntime.waitUntil`). Um único batch WhatsApp grande (ex.: 496 leads × ~5 s avg na Lambda × sub-lotes de 5 a cada 500 ms ≈ 9 min) é morto silenciosamente pelo runtime, deixando o batch em `processing`, o job com `updated_at` congelado e os leads restantes sem retry. O safety net no frontend (`ActiveCampaignJobIndicator`, `STUCK_THRESHOLD_MS=10min`) força `completed`/`failed` mas não recupera os leads.

Mitigação (apenas para `lot_index IS NULL`, ou seja, disparo manual/`immediate`):

- `MAX_LEADS_PER_BATCH = 250` e `STAGGER_MS = 30_000`.
- Após carregar `leads` e aplicar a revalidação `data_disparo_ia`, se `leads.length > 250`:
  1. O batch atual é encolhido para os primeiros 250 (`UPDATE lead_ids, total_leads`).
  2. Os leads excedentes viram N novos `campaign_batches` com `status='scheduled'`, `lot_index` definido, `batch_index` sequencial após o máximo atual do job e `scheduled_at = now() + (i+1)*30s`.
  3. O `scheduled-campaign-dispatcher` (cron a cada minuto) reivindica e processa cada filho numa invocação independente, reaproveitando todo o caminho do programado — incluindo a janela 07–20 (filhos com `scheduled_at` fora da janela são reagendados pelo dispatcher).
- A guarda `lot_index IS NULL` impede que os próprios filhos (que já têm `lot_index` definido) entrem novamente no chunking.
- IA Ligação está fora do escopo (usa `prospect_pri_voz`, latência por lead diferente, sem relato de travamento).

Observabilidade complementar: ao fim de cada batch processado é emitido um log `🏁 [BG] Batch <idx> finalizado: ...` com `leads_no_batch`, `sucesso`, `falha`, `duplicate`, `duration_ms`. Esse log dá a fronteira clara nos Edge logs caso um batch subsequente seja morto pelo runtime.

### Auditoria final por batch (`:638-667`)

```ts
supabase.from('logs_disparos').insert({
  job_id, batch_index, origem: 'edge_function',
  valor_unitario_usd: 0.06,  // WhatsApp
  custo_total_usd,
  total_sucesso, total_falha,
  template_id, template_nome, empresa_id, marca, uf
});
```

### Notificação (`:716-728`)

`INSERT` em `notificacoes` com `tipo='disparo_concluido'` para o `user_id` que criou o job, com contagens finais.

---

## 5. Payload externo (WhatsApp)

Montado em `process-campaign-job:478-494`, um POST por lead:

```json
{
  "prospeccao_id": "<uuid>",
  "evento_nome": "...",
  "event_id_pri": "...",
  "data_inicio": "...", "data_fim": "...",
  "canal": "Whatsapp",
  "telefone_pri": "<digits>",
  "pri_telefone": "<digits>",
  "telefone_pri_whatsapp": "<digits>",
  "nome_agente": "Pri ...",
  "dealer_id": "<crm_id>", "pri_dealer_id": "<crm_id>",
  "empresa_id": "<uuid>", "nome_empresa": "...",
  "uf": "...", "cidade": "...",
  "tipo_ia": "IA Whatsapp",
  "acao": "criar",
  "tem_variavel": "Sim|Não",
  "variable_mapping": { "1": "João Silva", "2": "SP" },
  "id": "<contato_uuid>", "lead_id": 12345,
  "nome": "...", "telefone": "...", "email": "...",
  "status": "Novo", "origem": "Importação",
  "data_importacao": "<ISO>", "tipo_importacao": "planilha",
  "proposalId": "PROP-001"
}
```

### Resolução de variáveis (`resolveVariableMapping`, `:38-65`)

`whatsapp_templates.variable_mapping` é `{ "<posição>": "<fieldName>" }`. O edge troca cada `fieldName` pelo valor real do lead/empresa/prospecção antes do POST. A Lambda interpola `{{1}}`, `{{2}}`, ... no corpo do template.

| `fieldName` | Origem |
|---|---|
| `nome_cliente` | `lead.nome` |
| `empresa` | `empresa.nome_empresa` |
| `marca` | `empresa.marca` (fallback nome) |
| `telefone` | `lead.telefone` |
| `data_atual` | `new Date().toLocaleDateString('pt-BR')` |
| `nome_prospeccao` | `prospeccao.titulo` |
| `data_inicio` / `data_fim` | `prospeccao.*` formatados pt-BR |
| `vendedor_nome` | `lead.vendedor_nome` |
| `uf` / `cidade` | `empresa.*` |
| *(desconhecido)* | literal do próprio `fieldName` |

---

## 6. Progresso em tempo real

`src/components/DispararProgressModal.tsx`:

- **Realtime** (`:90-113`): subscribe em `campaign_jobs` filtrado por `id=eq.${jobId}` → atualiza counters a cada `UPDATE`.
- **Falhas agregadas** (`:70-87`): poll de 5 s em `logs_disparos_falhas WHERE job_id=...`, agrupado por `categoria` com labels humanos (`CATEGORIA_LABEL`).
- **Stuck detection** (`:155`): job em `processing` há mais de 10 min sem update → mostra "Forçar Finalização", que marca job como `completed` e batches pendentes como `failed`.
- **Retomar Falhas** (`:306`): re-invoca `process-campaign-job` com mesmo `job_id`.
- Modal pode ser fechado a qualquer momento — o processamento continua no servidor (`EdgeRuntime.waitUntil`).

---

## 7. Persistência e auditoria

| Tabela | Quem escreve | Quando | Colunas-chave |
|---|---|---|---|
| `logs_disparos` (frontend) | `DispararCustoModal:120-139` | Confirmação do custo | `cotacao_dolar`, `custo_total_*`, `total_contatos` |
| `logs_disparos` (edge) | `process-campaign-job:642-665` | Fim de cada batch | `origem='edge_function'`, `job_id`, `batch_index`, totais, `template_*`, custo USD |
| `logs_disparos_falhas` | `process-campaign-job:326-331` | A cada sub-batch | `categoria`, `mensagem`, `http_status`, `contato_id` |
| `campaign_jobs` | Client + Edge | Criação / progresso granular / conclusão | `status`, `processed_records`, `failed_records`, `duplicate_records` |
| `campaign_batches` | Client + Edge | Criação / processamento | `lead_ids`, `status`, `retry_count`, `error_log` |
| `contatos.data_disparo_ia` | Edge (`flushSubBatch`) | Sucesso ou duplicate | `now()` |
| `eventos_prospeccao.data_disparo_ia` | Edge (`flushSubBatch`) | Sucesso ou duplicate | `now()` |
| `notificacoes` | Edge (`:716-728`) | Job concluído | `tipo='disparo_concluido'` |
| `prospeccoes.disparos_pausados` | Client (`:469`, `:533`) | Auto-release ou troca de template | `false` |

> **"Pendente" para WhatsApp** = `eventos_prospeccao.data_disparo_ia IS NULL` (query em `:1313`). É o que alimenta o contador do botão.

> Conforme `mem://architecture/prospeccao/logs-disparos-server-side`: o caminho frontend de `logs_disparos` está em desuso planejado; o `origem='edge_function'` é a fonte da verdade. O frontend ainda escreve por compatibilidade durante a transição.

---

## 8. Diagrama (texto)

```text
[UI: EventoBase /prospeccao/eventos/:id/base]
    │  click "Disparar WhatsApp (N)"
    ▼
[DispararCustoModal] ── insert logs_disparos (intenção, USD/BRL)
    │  confirmar
    ▼
[handleDispararIA]
    ├─ insert campaign_jobs (status=pending)
    ├─ insert campaign_batches × N (1000 leads cada)
    └─ functions.invoke('process-campaign-job')   ← fire-and-forget
    │
    ▼
[DispararProgressModal] ── subscribe Realtime campaign_jobs
                          poll logs_disparos_falhas (5s)

──────────────  Edge Function (background) ──────────────
[process-campaign-job]
    │ EdgeRuntime.waitUntil(processJobInBackground)
    │ responde HTTP 202 imediatamente
    ▼
 para cada batch (até 3 retries):
   para cada sub-batch de 5 leads (delay 500ms):
      POST https://ccnv217nqk...amazonaws.com/dev/disparo
           x-api-key: <secret>
           body: payload por lead (com variable_mapping resolvido)
      ↓
      flushSubBatch():
        update contatos.data_disparo_ia
        update eventos_prospeccao.data_disparo_ia
        insert logs_disparos_falhas[]
        update campaign_jobs (processed/failed/duplicate)
   fim
   insert logs_disparos (origem=edge_function, totais do batch)
 fim
 update campaign_jobs.status = completed|failed
 insert notificacoes (disparo_concluido)
```

---

## 9. Lacunas e pontos de atenção

1. **Opt-out / quarentena**: nenhuma checagem client-side ou edge antes do POST. A deduplicação real depende da Lambda responder `"disparo repetido"`. As tabelas `global_opt_outs`, `contato_quarentena` e o helper `_shared/external-optout.ts` existem mas **não estão neste caminho**. Confirmar se a Lambda enforce essas listas — caso contrário, há risco de disparo para números bloqueados.
2. **`dispatch-leads-webhook`** tem pipeline completo próprio (WA em batches de 50) mas **não é chamado** por `handleDispararIA`. Investigar se algum outro caminho ainda usa, senão candidato a deprecação.
3. **Schema da resposta da Lambda**: classificação por keyword em string. Qualquer novo padrão de erro retornado pela Lambda passaria silenciosamente como sucesso.
4. **`logs_disparos` duplicidade**: frontend + edge escrevem na mesma tabela. Relatórios devem filtrar por `origem` para evitar dupla contagem (ver memória `logs-disparos-server-side`).
5. **Telefone do agente IA**: matching por substring `"pri"+"whatsapp"` no nome do agente em `agente_empresas`/`agentes_ia` — frágil a renomeações.

---

## 10. Checklist de regressão

- [ ] Disparar evento WhatsApp com template ativo válido
- [ ] Evento com `disparos_pausados=true` (UI deve travar)
- [ ] Auto-release de pausa ao corrigir template
- [ ] Disparo personalizado (quantidade < pendentes)
- [ ] Disparo > 1 000 leads (múltiplos batches)
- [ ] Permissão `canDispararEventos` ausente (botão Lock)
- [ ] Lead que a Lambda responde `"disparo repetido"` → `duplicate` (não falha)
- [ ] Timeout de 30 s → categoria `timeout` e retry funcionando
- [ ] Fechar modal e reabrir → progresso continua via Realtime
- [ ] Job travado >10 min → botão "Forçar Finalização"
- [ ] Retomar Falhas → re-invoca função sem duplicar leads bem-sucedidos
- [ ] `logs_disparos` (edge) + `logs_disparos_falhas` populados
- [ ] `contatos.data_disparo_ia` e `eventos_prospeccao.data_disparo_ia` gravados
- [ ] `notificacoes` criada para o usuário disparador
- [ ] Disparo imediato com 50 leads → 1 batch único, sem chunking
- [ ] Disparo imediato com 600 leads → batch original reduzido a 250 + 2 batches `scheduled` (250 e 100) reivindicados pelo cron; somatório `processed_records=600`
- [ ] Disparo imediato fora da janela 07–20 → primeiro batch roda imediato; filhos com `scheduled_at` futuro respeitam o reagendamento do dispatcher

---

## 11. Disparo programado (cadenciado)

Além do disparo imediato (seções 1–10), o evento permite **programar** o envio para uma data/hora futura, opcionalmente quebrado em vários lotes com intervalo.

### 11.1 Entrada na UI

- Botão **"Programar disparo"** em `EventoBase.tsx` abre `src/components/ProgramarDisparoModal.tsx`.
- A lista de jobs já programados aparece em `src/components/DisparosProgramadosList.tsx`, alimentada por `src/hooks/useScheduledCampaignJobs.ts`.
- Mesmas validações de permissão e `disparos_pausados` do fluxo imediato.

### 11.2 `ProgramarDisparoModal` — regras de negócio

| Regra | Valor | Onde |
|---|---|---|
| Fuso fixo | `America/Sao_Paulo` (offset `-03:00`, sem DST) | `TZ`, `buildScheduledIso` |
| Janela permitida | **07:00–20:00** (último slot 20:00) | `JANELA_INICIO_H` / `JANELA_FIM_H`, `isWithinWindow` |
| Slots | A cada 30 min | `buildSlots` |
| Primeiro envio | Estritamente no futuro | validação `f.getTime() <= Date.now()` |
| Limite final | ≤ 23:59 (Brasília) da `prospeccoes.data_fim` | `dataFimLimite` |
| Lote máximo | **5 000 contatos** | `LOTE_TETO` |
| Intervalo mínimo entre lotes | **30 min** (opções: 30 min ou 1 h) | `intervaloMin` |
| TODOS os lotes precisam cair dentro da janela e antes da `data_fim` | UI lista os lotes inválidos antes de permitir submit |

> **Janela 07–20 é também reforçada server-side.** O `scheduled-campaign-dispatcher`
> (seção 11.4) verifica o relógio em `America/Sao_Paulo` antes de invocar qualquer
> batch. Se o tick cair fora de 07:00–20:00, **todos os batches reivindicados são
> devolvidos para `status='scheduled'`** com `scheduled_at` ajustado para o próximo
> 07:00, `locked_at`/`locked_by` limpos. Nada é disparado e nada é notificado ao
> usuário (proteção silenciosa contra batches manuais/drift de cron).

Modos de divisão (`cadenceType`):

- `none` → 1 lote único com todos os contatos.
- `by_lot_count` → N lotes de tamanho `ceil(total/N)`.
- `by_lot_size` → lotes de tamanho fixo (último pode ser menor).

Saída do modal (`ProgramarDisparoConfig`): `{ scheduledIso, cadenceType, intervalMinutes, lotCount, lotSize, timezone }`.

### 11.3 Persistência ao confirmar

`handleConfirmarPrograma` (em `EventoBase.tsx`) cria 1 `campaign_jobs` com:

```text
status            = 'scheduled'
dispatch_mode     = 'scheduled'
first_scheduled_at, cadence_type, interval_minutes, timezone
```

e N `campaign_batches` com:

```text
status        = 'scheduled'
scheduled_at  = first_scheduled_at + (lot_index * interval_minutes) minutos
lot_index     = 0..N-1
lead_ids      = slice de contatos pendentes
```

> **Snapshot dos leads é congelado aqui.** `lead_ids` é gravado a partir de
> `fetchContatosPendentes()` (que, para WhatsApp, lê `eventos_prospeccao` com
> `data_disparo_ia IS NULL`). A edge **revalida** esse status no momento real
> do disparo (ver 11.5) — leads que deixaram de ser pendentes entre o
> agendamento e o horário programado são pulados, não consomem custo, e
> entram em `logs_disparos_falhas` com `categoria='lead_nao_pendente'`.

> Estados válidos de `campaign_jobs.status` agora incluem `'scheduled'` e `'partially_completed'` (constraint `campaign_jobs_status_check` atualizada na migração `20260617151825_...sql`). Sem esses valores o INSERT falhava com `23514`.

### 11.4 Cron → `scheduled-campaign-dispatcher`

`supabase/functions/scheduled-campaign-dispatcher/index.ts` roda como tick periódico (pg_cron) e:

1. Chama RPC `claim_due_campaign_batches(p_limit=10, p_worker_id=...)` — `SECURITY DEFINER` que faz `UPDATE campaign_batches SET status='processing', locked_at=now(), locked_by=worker WHERE status='scheduled' AND scheduled_at <= now() ORDER BY scheduled_at LIMIT N FOR UPDATE SKIP LOCKED`.
2. Para cada batch reivindicado, invoca `process-campaign-job` em **fire-and-forget** com `{ job_id, batch_id }`, usando `SUPABASE_SERVICE_ROLE_KEY`.
3. Se a invocação retornar !ok, chama `handleDispatchFailure`: marca o batch como `failed`, e cria `notificacoes (tipo='disparo_falhou')` deduplicada por link `/prospeccao/<id>?job=<jobId>`.

### 11.5 `process-campaign-job` em modo programado

- O handler aceita `batch_id` opcional. Quando presente, processa **somente aquele batch**, em vez de varrer todos `pending`/`failed` do job.
- **Revalidação de pendente (WhatsApp):** logo após carregar `leads` do batch, consulta `eventos_prospeccao(prospeccao_id, contato_id)` filtrando `data_disparo_ia IS NOT NULL`. Para cada contato encontrado:
  - É **removido** do array `leads` (não vai à Lambda — sem custo).
  - Vai para `logs_disparos_falhas` com `categoria='lead_nao_pendente'`.
  - Incrementa o contador `duplicate_records` do job (não conta como falha).
  - Se o batch ficar vazio após o filtro, é marcado `completed` com `error_log` explicativo.
- IA Ligação usa `prospect_pri_voz.id` (não `contato_id`); a revalidação não se aplica e a deduplicação fica por conta da Lambda de ligação (categoria `duplicate`).
- Pipeline interno (sub-batches 5/500ms, `flushSubBatch`, `logs_disparos_falhas`, `logs_disparos(origem='edge_function')`, etc.) é o mesmo do disparo imediato.
- Ao terminar um batch, recalcula o status do job:
  - Se ainda há batches `scheduled` com `scheduled_at > now()` → mantém `status='scheduled'` (job entre lotes — NÃO é "travado").
  - Se todos concluíram sem falhas residuais → `completed`.
  - Se concluíram mas algum batch falhou definitivamente → `partially_completed`.
  - Se todos falharam → `failed`.

### 11.6 Indicador global `ActiveCampaignJobIndicator`

`src/components/ActiveCampaignJobIndicator.tsx` filtra jobs `pending`/`processing` da empresa ativa. Para evitar falso-positivo de "Disparo travado" em jobs cadenciados (que ficam ~30 min/1 h ociosos entre lotes), o indicador:

1. Antes de mostrar "Disparando %": consulta `campaign_batches` com `status='scheduled'` e `scheduled_at > now()` para o job. Se houver, **esconde o indicador** (não é trabalho ativo).
2. Em `autoResolveStuckJob`: faz a mesma checagem antes de marcar o job como `completed`; aborta a finalização se ainda houver lotes scheduled futuros.
3. Ao finalizar um job realmente travado, marca como `failed` apenas batches em `pending`/`processing` — nunca os `scheduled`, que continuam reivindicáveis pelo dispatcher.

### 11.7 Lista + cancelamento (`DisparosProgramadosList`)

- `useScheduledCampaignJobs` busca jobs com `dispatch_mode='scheduled'` e `status IN ('scheduled','processing','partially_completed')`, junto com seus batches, e assina Realtime em `campaign_jobs`/`campaign_batches`.
- Botão **Cancelar** chama RPC `cancel_scheduled_campaign_job(p_job_id)` (SECURITY DEFINER): marca job como `cancelled` (com `cancelled_at`, `cancelled_by`) e batches ainda `scheduled` como `cancelled`. Batches já em `processing`/`completed` não são alterados.

### 11.8 Tabelas e colunas adicionais

| Coluna | Tabela | Uso |
|---|---|---|
| `dispatch_mode` | `campaign_jobs` | `'immediate'` (default) ou `'scheduled'` |
| `first_scheduled_at` | `campaign_jobs` | Horário do primeiro lote |
| `cadence_type` | `campaign_jobs` | `'none'`/`'by_lot_count'`/`'by_lot_size'` |
| `interval_minutes` | `campaign_jobs` | 0 para `none`, ≥30 caso contrário |
| `timezone` | `campaign_jobs` | Sempre `'America/Sao_Paulo'` por enquanto |
| `cancelled_at` / `cancelled_by` | `campaign_jobs` | Cancelamento manual |
| `scheduled_at` | `campaign_batches` | Quando o batch deve ser reivindicado |
| `lot_index` | `campaign_batches` | Ordem do lote dentro do job |
| `locked_at` / `locked_by` | `campaign_batches` | Lock cooperativo do dispatcher (SKIP LOCKED) |

### 11.9 Diagrama (programado)

```text
[UI: ProgramarDisparoModal]
    │ confirmar
    ▼
[handleConfirmarPrograma]
    ├─ insert campaign_jobs (status=scheduled, dispatch_mode=scheduled, cadence_*)
    └─ insert campaign_batches × N (status=scheduled, scheduled_at = T0 + i*Δ)

─────────── Cron tick (pg_cron) ───────────
[scheduled-campaign-dispatcher]
    │ rpc claim_due_campaign_batches(limit=10)
    │   → UPDATE ... WHERE scheduled_at <= now() FOR UPDATE SKIP LOCKED
    │ para cada batch reivindicado:
    │   fetch process-campaign-job { job_id, batch_id }   (fire-and-forget)
    │   on !ok → batch=failed + notificacoes(disparo_falhou)
    ▼
[process-campaign-job] (mesmo pipeline da seção 4, mas filtrado pelo batch_id)
    └─ ao final: recalcula status do job
         scheduled (lotes futuros) | completed | partially_completed | failed
```

### 11.10 Checklist de regressão (programado)

- [ ] Programar 1 lote único no futuro próximo → executa no horário
- [ ] Programar 2+ lotes com intervalo 30 min → cada lote dispara separadamente
- [ ] Indicador global NÃO mostra "Disparo travado" entre lotes
- [ ] Cancelar job programado → batches `scheduled` viram `cancelled`, batches já rodando seguem
- [ ] Tentar programar fora da janela 07:00–20:00 → bloqueado na UI
- [ ] Tentar programar lote depois da `data_fim` → bloqueado na UI
- [ ] Lote > 5 000 contatos → bloqueado na UI
- [ ] Dispatcher reivindica em paralelo sem duplicar (SKIP LOCKED)
- [ ] Falha de invocação do dispatcher gera `notificacoes(disparo_falhou)` deduplicada
- [ ] Após todos os lotes: status final = `completed` | `partially_completed` | `failed` corretamente
- [ ] **Inserir batch manual com `scheduled_at` às 03:00** → cron NÃO dispara; batch é reagendado para 07:00 com `locked_at`/`locked_by` limpos
- [ ] **Avançar um lead manualmente antes do horário programado** → edge pula o lead, registra em `logs_disparos_falhas` com `categoria='lead_nao_pendente'` e incrementa `duplicate_records` do job

---

## 12. Notificações in-app do disparo

Sistema canônico documentado em [`docs/notificacoes.md`](./notificacoes.md). Esta seção
lista apenas os pontos do fluxo de disparo que emitem notificação.

| Origem | `tipo` | Quando | `link` |
|---|---|---|---|
| `process-campaign-job` (final do job) | `disparo_concluido` | Job termina sem falhas críticas | `/prospeccao/<prospeccao_id>?job=<job_id>` |
| `process-campaign-job` (final com falhas) | `disparo_falhou` | Job termina com >0 falhas — mensagem agrega categorias (ex: "30 número inválido, 12 agente não encontrado") | idem |
| `process-campaign-job` (catch global) | `disparo_falhou` | Exceção não tratada no processamento | idem |
| `scheduled-campaign-dispatcher` | `disparo_falhou` | `fetch` para `process-campaign-job` retornou !ok ou levantou erro | idem |
| `ActiveCampaignJobIndicator` (frontend) | `disparo_falhou` | Auto-resolve por timeout (>10 min sem update e sem batches `scheduled` futuros) | idem |

Todas usam o helper `_shared/notificacoes.ts` (`inserirNotificacao`) com
`idempotenteByLink=true` — o mesmo `(user_id, tipo, link)` nunca duplica. Como o
link carrega o `job_id`, jobs diferentes geram notificações distintas mesmo no
mesmo evento.

**O que NÃO gera notificação:**

- Reagendamento por janela 07–20 (silencioso — é correção interna, não falha).
- Leads pulados por `lead_nao_pendente` (ficam só em `logs_disparos_falhas`).
- Cancelamento manual via `DisparosProgramadosList` (a UI já confirma).

---

## 13. Self-chain immediate (jun/2026)

Disparos **immediate** (batches com `lot_index IS NULL`) deixaram de depender de
uma única invocação longa de `process-campaign-job`. Agora cada isolate processa
exatamente **1 batch** e, ao terminar, faz `fetch` fire-and-forget de volta para
`process-campaign-job` com o header `x-chain-depth` incrementado (cap **100**).

- Escopo: apenas `lot_index IS NULL`. Disparos programados continuam no
  `scheduled-campaign-dispatcher` + janela 07–20, sem alteração.
- **Seleção do próximo batch e claim usam a mesma cláusula** — sem isso
  a recuperação de batch órfão não funciona:

  ```sql
  WHERE job_id = ?
    AND lot_index IS NULL
    AND retry_count < MAX_RETRIES
    AND (
      status IN ('pending','failed')
      OR (status = 'processing' AND updated_at < now() - interval '10 minutes')
    )
  ORDER BY
    CASE WHEN status = 'processing' THEN 0 ELSE 1 END,  -- stale primeiro
    batch_index
  LIMIT 1;
  ```

  A claim é feita via RPC `claim_next_immediate_batch` (`SECURITY DEFINER`,
  só `service_role`) e o `UPDATE ... RETURNING` espelha exatamente a cláusula
  acima. Se 0 linhas → encerra elo com `reason=already_claimed`.

- **Cancel-check** (`status='cancelled'` OU `cancelled_at IS NOT NULL`) antes
  de marcar job como `processing` e entre elos: nunca ressuscita job
  cancelado; elo aborta com `reason=cancelled`.

- **Logs estruturados** (sem PII) — permitem reconstruir cadeia por `job_id`:

  ```text
  🔗 [CHAIN] start job=<id> batch_id=<id> batch_index=<n> depth=<n> prev_status=<s> lead_count=<n>
  🏁 [BG] Batch finalizado job=<id> batch_index=<n> final_status=<s>
         processed=<n> failed=<n> duplicate=<n>
         skipped_already_dispatched=<n> duration_ms=<n>
  🔗 [CHAIN] next-invoked job=<id> next_batch_index=<n> next_prev_status=<s> depth=<n+1>
  🔚 [CHAIN] end-of-chain job=<id>
         reason=<no_more|cap_reached|cancelled|already_claimed|job_completed>
  ```

- Cap atingido (`x-chain-depth >= 100`): aborta cadeia, seta
  `error_message='Cap de self-chain atingido (100)'`, emite `disparo_falhou`
  idempotente por `link`.

## 14. Revalidação imediata anti-duplicidade

Antes de montar o payload da Lambda no caminho immediate, o batch é
revalidado contra `eventos_prospeccao` por `(prospeccao_id, contato_id)`:
contatos cujo `eventos_prospeccao.data_disparo_ia IS NOT NULL` são
descartados e contabilizados em `skipped_already_dispatched` no log
`🏁 [BG]`.

- Gate canônico = `eventos_prospeccao.data_disparo_ia` (espelha o caminho
  scheduled).
- **Sem fallback** em `contatos.data_disparo_ia` no hot path — a tabela é
  grande demais; o custo de leitura não compensa para o caso degenerado em
  que apenas o lado contatos foi atualizado.

## 15. Diagnóstico de jobs immediate

View `vw_immediate_jobs_status` (security_invoker + `user_can_access_empresa`)
expõe por job:

- `classificacao`: `vivo` | `orfao` | `concluido`
- `immediate_batches_total`, `immediate_open` (usa a mesma cláusula da
  seleção/claim).

Recuperação de batch travado vive em
[`docs/recuperacao-jobs-orfaos.md`](./recuperacao-jobs-orfaos.md).
