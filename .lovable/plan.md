## Escopo reduzido

Aplicar apenas as partes 3 e 4 do plano anterior. Sem alterar trigger PG nem criar tabela de idempotência por enquanto.

## 1. Remover callers explícitos remanescentes de `movimentacao_lead_kanban`

### `src/pages/Prospeccao.tsx`
Remover os dois `supabase.functions.invoke('trigger-webhook', { gatilho: 'movimentacao_lead_kanban', ... })`:
- `executeKanbanStatusChange` (~linha 1218-1232).
- Fluxo principal de drag-and-drop do Kanban (~linha 1503-1527), incluindo o `whResult`/log/`fetchKanbanColumns` que dependiam do retorno.

Substituir por comentário explicando que o dispatch agora é server-side via trigger PG.

Efeito colateral conhecido: a reconciliação silenciosa do kanban para capturar `codigo_proposta` deixa de ser disparada nesse retorno. Como o `codigo_proposta` é gravado pelo backend ao processar o webhook do trigger PG, ele continuará aparecendo no próximo refresh natural do kanban. Se notarmos atraso visível, tratamos em iteração separada (ex.: realtime em `contatos.codigo_proposta`).

### `supabase/functions/prospeccao-status/index.ts`
Remover o bloco "webhook secundário (movimentação kanban)" (~linha 452-468). O `UPDATE contatos.status` desta edge já insere em `logs_movimentacao_contatos`, e o trigger PG cuida do dispatch.

Manter intacto:
- webhook principal `alteracao_status_contato`.
- extração de `codigo_proposta` quando `webhook_kind = 'criacao_lead'`.

## 2. Atualizar documentação

### `docs/fluxo-checkin-recepcao.md`
- Substituir a linha 45 ("Dispara webhook `movimentacao_lead_kanban` (fire-and-forget no FE)") por: dispatch ocorre exclusivamente via trigger PG após o `INSERT` em `logs_movimentacao_contatos`.
- Reforçar na seção 6 que Kanban (`Prospeccao.tsx`) e `prospeccao-status` também não invocam mais a edge para esse gatilho.

## 3. Validação

- Mover lead no Kanban → 1 execução em `trigger-webhook`.
- Check-in via FAB/QR → 1 execução.
- `PUT /prospeccao-status` (alteração de status via edge) → 1 execução de `movimentacao_lead_kanban` (vinda do trigger PG) + 1 execução de `alteracao_status_contato` (já era assim).
- Conferir em `net._http_response` que não há mais dois dispatches no mesmo segundo para o mesmo `contato_id`.

## O que não vou alterar

- Trigger `trg_dispatch_movimentacao_lead_webhook` permanece como está.
- Não crio tabela de idempotência ainda.
- Não mexo no payload nem no `confirm-presence`.
- Não mexo no `prospeccao-anotacao` (gatilho diferente).