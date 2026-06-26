## Diagnóstico

O webhook `movimentacao_lead_kanban` está sendo disparado **duas vezes** porque dois caminhos diferentes chamam `trigger-webhook` para o mesmo `INSERT` em `logs_movimentacao_contatos`:

1. **Trigger server-side** `trg_dispatch_movimentacao_lead_webhook` (criado recentemente para resolver race condition de FE que abortava ao fechar modal) → chama `trigger-webhook` via `pg_net` toda vez que um log é inserido.
2. **Invoke explícito do frontend / outras edges** que continuou no código depois que o trigger foi adicionado:
   - `src/hooks/useRecepcaoData.ts` linha ~472 (`registrarCheckin` — QR)
   - `src/hooks/useRecepcaoData.ts` linha ~909 (`registrarCheckinMulti` — FAB)
   - `supabase/functions/prospeccao-status/index.ts` linha ~456 (mudança de status via Kanban)
   - `supabase/functions/confirm-presence/index.ts` linha ~166 (confirmação via link público)

Resultado visível no print: duas execuções `Succeeded` no mesmo segundo (9.4s e 10.4s).

## Correção

Fonte única de verdade = **PG trigger** (`pg_net`). Remover as invocações duplicadas em código:

### 1. `src/hooks/useRecepcaoData.ts`
- Remover o bloco `supabase.functions.invoke("trigger-webhook", ...)` em `registrarCheckin` (linhas ~471-496).
- Remover o bloco equivalente em `registrarCheckinMulti` (linhas ~906-932).
- Manter os `INSERT`s em `logs_movimentacao_contatos` — o trigger PG cuida do dispatch.

### 2. `supabase/functions/prospeccao-status/index.ts`
- Remover a chamada `trigger-webhook` com `gatilho: 'movimentacao_lead_kanban'` (helper `callTriggerWebhook` na rota de status, ~linha 456). A função já insere em `logs_movimentacao_contatos`, então o trigger PG dispara.
- Manter o retorno de `webhook_status` no payload como `not_invoked` (ou ajustar para `skipped: server_side_trigger`) para o wrapper `setContatoStatus` não acusar falha.

### 3. `supabase/functions/confirm-presence/index.ts`
- Remover a chamada direta a `dispararMovimentacaoLeadKanban` (linha ~166). O `INSERT` em `logs_movimentacao_contatos` (linha ~151) já aciona o trigger.
- Preservar o `email_vendedor` fallback (`contatos.responsavel_email`) salvando-o em uma coluna ou repassando via canal alternativo, **OU** estender o trigger PG para resolver esse fallback do lado do banco. **Decisão sugerida:** manter o comportamento atual de `confirm-presence` por enquanto (caminho público, sem `usuario_id`), mas adicionar guarda no trigger PG para **não** redisparar quando o INSERT vier do contexto de `confirm-presence`.

   Opções para evitar o duplo disparo nesse caso público:
   - **Opção A (preferida):** acrescentar coluna técnica `logs_movimentacao_contatos.webhook_dispatch_source` (default `'trigger'`). `confirm-presence` insere com valor `'edge'` e o trigger PG faz `WHEN NEW.webhook_dispatch_source = 'trigger'`. Demais call sites caem no default.
   - **Opção B:** remover a chamada direta de `confirm-presence` e ensinar o trigger PG a resolver `email_vendedor` via `contatos.responsavel_email` quando `usuario_id IS NULL`. Mais simples; aceitável se a confirmação pública sempre tiver `responsavel_email`.

   **Recomendação: Opção B**, pois mantém uma única rota e simplifica o código. Verificar se `contatos.responsavel_email` sempre existe nesse fluxo; se sim, mover o fallback para dentro de `dispararMovimentacaoLeadKanban` (já existe parcialmente) e remover a chamada direta.

### 4. Documentação / memória
- Atualizar `docs/fluxo-checkin-recepcao.md`: deixar claro que **apenas o trigger PG** dispara o webhook; FE nunca deve chamar `trigger-webhook` para `movimentacao_lead_kanban`.
- Atualizar memória `features/recepcao/fluxo-checkin` removendo "Dispara webhook ... (fire-and-forget no FE)".
- Adicionar memória nova `architecture/webhooks/movimentacao-lead-single-source` registrando a regra: "Único dispatcher é o trigger `trg_dispatch_movimentacao_lead_webhook`; proibido invocar `trigger-webhook` com `gatilho=movimentacao_lead_kanban` a partir de FE/edges que já inserem em `logs_movimentacao_contatos`."

## Validação

1. Fazer check-in via FAB e via QR → conferir nos logs da edge `trigger-webhook` que houve **1 execução** por check-in.
2. Mudar status de lead no Kanban → 1 execução.
3. Confirmar presença via link público → 1 execução, com `email_vendedor` preenchido a partir de `contatos.responsavel_email`.
4. Verificar `template_pausado_audit` / logs de Lambda MobiGestor: nenhum payload duplicado no mesmo segundo.
