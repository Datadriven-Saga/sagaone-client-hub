## Objetivo

1. Garantir que disparos agendados nunca rodem fora da janela 07:00–22:00 (Brasília), mesmo se um batch for inserido manualmente ou se o cron pegar um `scheduled_at` fora da janela.
2. Não disparar para leads que já saíram de "pendente" entre o agendamento e a hora do disparo.
3. Atualizar `docs/fluxo-disparo-whatsapp.md` com a verdade do sistema (janela, snapshot, notificações).

## Estado atual (resumo do diagnóstico)

- **Janela 07–22 só existe no frontend** (`ProgramarDisparoModal.tsx`, `JANELA_INICIO_H=7`, `JANELA_FIM_H=22`). Cron e edge não validam.
- **Cron roda a cada minuto, 24h** (`scheduled-campaign-dispatcher`), apenas reivindica batches com `scheduled_at <= now()`.
- **Snapshot dos leads é congelado no agendamento** (`EventoBase.tsx` linha 1650 lê `contatosPendentes` e grava em `campaign_batches.lead_ids`). A edge `process-campaign-job` lê esse array fixo (linha 328) e dispara sem refiltrar por status.
- Documento `docs/fluxo-disparo-whatsapp.md` não menciona notificações, nem deixa claro o snapshot.

## Mudanças

### 1. `scheduled-campaign-dispatcher/index.ts` — proteção de janela

Antes de invocar `process-campaign-job` para cada batch reivindicado, conferir a hora atual em `America/Sao_Paulo`. Se estiver fora de 07:00–22:00:

- **Não disparar.**
- Liberar o batch de volta para `status='scheduled'` (limpar `locked_at`/`locked_by`) e atualizar `scheduled_at` para o próximo slot válido (próximo 07:00 do mesmo dia se antes das 07h, ou 07:00 do dia seguinte se depois das 22h), preservando o `lot_index`.
- Logar a ação (`console.log('🌙 [DISPATCHER] Fora da janela — reagendado para …')`).
- Não notificar o usuário (é uma proteção silenciosa contra desvio).

Janela é hardcoded como `WINDOW_START_H=7` / `WINDOW_END_H=22` no arquivo, com helper `nextWindowSlot(now)` retornando ISO em UTC. Não criar dependência nova — usar `Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })` para extrair a hora local.

### 2. `process-campaign-job/index.ts` — revalidação de status do lead

Logo após carregar `leads` do batch (linha ~331 para WhatsApp, e equivalente para IA Ligação), antes do loop de disparo:

- Buscar de `contatos` o `status` atual de todos os `lead_id` envolvidos (sub-batches de 100, mesmo padrão já usado).
- Considerar **elegíveis** apenas os com `status IN ('Novo', 'Pendente')` (mesmo critério usado em `contatosPendentes`).
- Para cada lead descartado:
  - Incrementar `invDuplicate` (reusar o contador de "ignorados"; alternativa: novo campo, mas evitamos migração).
  - Logar em `logs_disparos_falhas` com `categoria='lead_nao_pendente'`, `mensagem='Status mudou após agendamento: <status atual>'`.
- Seguir o pipeline normal só com os elegíveis.

Para IA Ligação, a fonte é `prospect_pri_voz` → joinar com `contatos` pelo `lead_id` (já existe nos prospects) e aplicar o mesmo filtro.

### 3. `docs/fluxo-disparo-whatsapp.md` — atualização

Acrescentar/ajustar na Seção 11 (Disparo programado):

- **11.X Janela 07:00–22:00**: descrever que é validada no frontend (UX) E reforçada no `scheduled-campaign-dispatcher` (silenciosamente reagenda para o próximo slot). Listar exatamente o comportamento de reagendamento.
- **11.Y Snapshot dos leads**: deixar explícito que `lead_ids` é congelado no momento do agendamento (`contatosPendentes`) e que a edge **revalida o status atual** antes de disparar; leads que saíram de pendente entram em `logs_disparos_falhas` com categoria `lead_nao_pendente` e não consomem custo.
- **Nova Seção 12 — Notificações in-app do disparo**: tabela curta apontando os tipos emitidos (`disparo_concluido`, `disparo_falhou`), origem (`process-campaign-job`, `scheduled-campaign-dispatcher`, `ActiveCampaignJobIndicator`), quando, e `link` usado (`/prospeccao/<id>?job=<id>`). Linkar `docs/notificacoes.md` como referência canônica do sistema de notificações.
- Atualizar o **checklist de regressão** com:
  - "Inserir batch manual com `scheduled_at` às 03:00 e confirmar que o cron reagenda para 07:00 sem disparar."
  - "Agendar disparo, alterar status de um lead para 'Confirmado' antes do horário, e confirmar que a edge pula o lead com log `lead_nao_pendente`."

## Arquivos tocados

- `supabase/functions/scheduled-campaign-dispatcher/index.ts` — janela + reagendamento.
- `supabase/functions/process-campaign-job/index.ts` — revalidação de status (WhatsApp e IA Ligação).
- `docs/fluxo-disparo-whatsapp.md` — janela, snapshot, notificações, checklist.

## Validação

- Logs do `scheduled-campaign-dispatcher` mostrando "Fora da janela — reagendado" quando forçado.
- Logs do `process-campaign-job` mostrando `[BG] X leads pulados (status mudou após agendamento)`.
- `logs_disparos_falhas` com a nova categoria após teste.
- Disparos noturnos do bug original não devem mais ocorrer.

## Fora de escopo

- Não mudar o frontend (`ProgramarDisparoModal`) — a guarda visual continua igual.
- Não criar nova coluna em `campaign_batches` para "leads pulados por status".
- Não tornar a janela configurável por empresa (pode virar feature flag depois).
