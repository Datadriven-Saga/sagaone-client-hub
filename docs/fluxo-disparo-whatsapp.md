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
