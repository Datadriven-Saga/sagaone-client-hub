## Ajustes em Programar Disparo (WhatsApp)

### 1. Data do disparo limitada por `data_fim` do evento
- `ProgramarDisparoModal` recebe nova prop `dataFimEvento?: string | null`.
- `EventoBase.tsx` passa `prospeccao.data_fim` ao renderizar o modal.
- Calendário: `disabled = d < hoje || (dataFimEvento && d > dataFimEvento)`.
- Validação extra: o **último lote** (`firstIso + (totalLotes-1) * intervalo`) não pode ultrapassar `dataFimEvento 23:59 -03:00`. Se passar → erro: *"Último lote (dd/MM HH:mm) cai depois do término do evento (dd/MM). Reduza lotes ou intervalo."*.
- Sem `data_fim`, mantém comportamento atual.

### 2. Intervalo entre lotes apenas 30 min e 1 h
- `<Select>` de intervalo passa a ter só `30` e `60`.
- Default 30. Remover validação redundante "múltiplo de 30" (mantém o mínimo).

### 3. Garantir TODOS os lotes na janela 07:00–22:00
- Hoje o loop quebra no primeiro lote inválido. Vou listar até 3 lotes problemáticos na mesma mensagem.
- Mesma checagem é reaproveitada com a restrição de `data_fim` do item 1.

### 4. Capturar erros da Lambda e notificar quem disparou

**Como vai funcionar (notificação)**
- Canal: **in-app**, via tabela `notificacoes` (mesmo padrão do `disparo_concluido` que já existe).
- Quem recebe: o `user_id` dono do `campaign_jobs` (quem clicou em "Programar disparo").
- Onde aparece: sininho do header (`Notificacoes.tsx`) + toast em tempo real para quem está com o app aberto (subscribe já existe).
- **Sem e-mail** nesta entrega (mantém escopo).

**Quando criar a notificação**
1. **Falha crítica do job** (catch global do `process-campaign-job`, hoje só marca `failed` sem notificar):
   - `tipo='disparo_falhou'`, `titulo='Falha no disparo programado'`, `mensagem='<evento>: <error.message>'`.
2. **Batch esgotou retries** (já cai em `partially_completed`/`failed`, mas sem detalhe para o user): incluir resumo das categorias de erro.
3. **Dispatcher não conseguiu invocar a função** (`scheduled-campaign-dispatcher`): se o `fetch` der erro ou HTTP não-2xx, marcar batch como `failed` com `error_log='Dispatcher: <msg>'` e notificar.
4. **Job auto-resolvido por timeout** (`ActiveCampaignJobIndicator.autoResolveStuckJob`): além do toast atual, persistir notificação para quem não estava com o app aberto.

**Conteúdo da mensagem (agregação por categorias da Lambda)**
A função `classifyError` em `process-campaign-job/index.ts` (linhas 28-36) já classifica respostas em `duplicate / workflow_inactive / timeout / http_error / empty_body / outro`. Vou estendê-la para os erros que você listou e exibir um resumo amigável:

| Categoria nova | Detecção (body lowercase + status) |
|---|---|
| `numero_invalido` | contém `numero invalido`, `telefone do lead invalido`, `numero pri invalido` |
| `agente_nao_encontrado` | status 404 + `agente nao encontrado` ou `instancia maia nao encontrada` |
| `evento_nao_encontrado` | status 404 + `evento pri nao encontrado` |
| `cadencia_nao_encontrada` | status 404 + `cadencia nao encontrada` |
| `template_nao_encontrado` | status 404 + `template nao encontrado` |
| `payload_invalido` | status 400 + `payload bruto invalido`, `empty event`, `invalid json`, `missing body` |
| `duplicate` | `disparo repetido` (já existe — não conta como falha) |
| `template_pausado` | body com `template_pausado` (HTTP 200) |
| `erro_meta` | body com `erro_meta` (HTTP 200) |
| `nao_avanca` | body com `nao_avanca` (HTTP 200) |
| `http_error` / `timeout` / `outro` | fallback (existente) |

Cada falha já vai para `logs_disparos_falhas` (existe). Ao finalizar/falhar o job, contabilizo as categorias do `logs_disparos_falhas` daquele `job_id` e monto a mensagem:

> *"Evento X: 1.200 enviados, 47 falhas — 30 número inválido, 12 agente não encontrado, 5 template pausado."*

Trunco em 240 chars. Botão na notificação leva para `/prospeccao/<id>` (campo `link` já existe em `notificacoes`).

**Idempotência**: antes de inserir, checar se já existe notificação com `tipo='disparo_falhou'` e `link` apontando para o mesmo `job_id` (uso o `link='/prospeccao/<id>?job=<job_id>'`).

### Arquivos tocados
- `src/components/ProgramarDisparoModal.tsx` — props, validações, opções de intervalo.
- `src/pages/prospeccao/EventoBase.tsx` — passar `data_fim`.
- `src/components/ActiveCampaignJobIndicator.tsx` — insert em `notificacoes` na auto-resolução.
- `supabase/functions/process-campaign-job/index.ts` — `classifyError` estendida + notificações no fim do job e no catch global.
- `supabase/functions/scheduled-campaign-dispatcher/index.ts` — tratamento de erro de invocação + notificação.

### Não vou mexer
- Schema do banco. `notificacoes.tipo` é texto livre (`disparo_concluido` já é inserido sem seed em `tipos_notificacao`). Se você quiser que `disparo_falhou` apareça em filtros tipados de `Notificacoes.tsx`, faço uma migration separada depois.
- Lógica de envio do disparo em si.

### Confirmações
- Intervalo só 30 min e 1 h ✅
- Notificação só in-app (sininho + toast), sem e-mail — ok seguir assim?
