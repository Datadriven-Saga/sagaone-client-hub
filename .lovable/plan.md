## Diagnóstico (lead `01fce4c9` — Vini, HYUNDAI É AGORA 2026 3ª EDIÇÃO)

Pelo `logs_movimentacao_contatos`:

| Hora (UTC) | De → Para | Origem |
|---|---|---|
| 18:05:28 | (null) → Check-in | **Recepção** ("Check-in via Recepção - Evento: …") |
| 19:23:17 | Check-in → Convidado | **Kanban** (você arrastou para fora) |

Nos logs do edge `trigger-webhook` **não há nenhuma chamada `movimentacao_lead_kanban`** — nem do check-in das 18:05, nem do retorno das 19:23.

Causas confirmadas:

1. **Move das 19:23 (Kanban Check-in → Convidado)**: o FE chama o webhook, mas o handler em `_shared/movimentacao-lead-webhook.ts` filtra com `STATUS_ELEGIVEIS = ['Confirmado','Check-in','Descartado']` → `Convidado` é ignorado por design. **Esperado.**
2. **Check-in das 18:05 (Recepção)**: o FE invoca `trigger-webhook` em **fire-and-forget** (`supabase.functions.invoke(...).then(...)`). Quando o modal `CheckinConfirmModal` fecha logo após o `toast`, o componente desmonta e a Promise pendente do `fetch` é **abortada** pelo runtime do navegador antes de a função edge ser invocada. Por isso, o webhook simplesmente nunca sai. Mesmo padrão existe em `registrarCheckin` (QR) e `registrarCheckinMulti` (busca por telefone).

O mesmo risco existe no Kanban quando o usuário troca de aba/navega rápido após soltar o card (lá o `await` já existe em `handleStatusChange`, mas em `executeKanbanStatusChange` — fluxo pós opt-out — também é `await`, então o Kanban está OK).

## Plano

### Parte A — Garantir entrega do webhook independente do ciclo de vida do FE (raiz do problema)

Criar um **trigger Postgres em `logs_movimentacao_contatos`** que dispara o webhook via `pg_net` (HTTP assíncrono no servidor) sempre que entrar um registro com:

- `status_novo IN ('Confirmado','Check-in','Descartado')`
- `prospeccao.canal IN ('Mensal','Grande Evento')`
- feature flag `webhook_movimentacao_lead` ativa para a empresa

O trigger chama `POST {SUPABASE_URL}/functions/v1/trigger-webhook` com `gatilho=movimentacao_lead_kanban` e os campos do log. A função edge mantém **toda a lógica de validação atual** (flag, canal, status, agente IA, montagem do payload externo, captura de `codigo_proposta`) — o trigger só dispara; quem decide tudo é o edge.

Vantagens:

- Funciona para Recepção (QR e busca), Kanban, ContatoModal, importações futuras e qualquer caminho que grave em `logs_movimentacao_contatos` (inclusive o "auto-trigger fallback" do trigger antigo).
- Imune a unmount do componente, refresh de página, perda de conexão do cliente.
- Idempotência: trigger só dispara em `AFTER INSERT`; mesmo se o FE também invocar, o edge `trigger-webhook` já é seguro (skip por status/canal/flag).

Detalhes técnicos:

- Usar `pg_net.http_post` (extensão já habilitada no projeto, usada em outros triggers).
- Authorization: service-role JWT (segredo `SUPABASE_SERVICE_ROLE_KEY`) lido de um GUC ou Vault — seguindo o padrão dos triggers existentes.
- Trigger marcado `SECURITY DEFINER`, `SET search_path = public`.
- Loga em `RAISE LOG` para auditoria; falha de `pg_net` **não bloqueia** o INSERT do log.

### Parte B — Retirar a invocação FE redundante (opcional, mas recomendado)

Após Parte A funcionando, remover (ou manter apenas como fallback awaitado) o `supabase.functions.invoke('trigger-webhook', ...)` em:

- `useRecepcaoData.ts` → `registrarCheckin` (QR)
- `useRecepcaoData.ts` → `registrarCheckinMulti` (busca por telefone)

No `Prospeccao.tsx` (`handleStatusChange` / `executeKanbanStatusChange`) a chamada já é `await`, mas como o trigger garante entrega, simplifico para apenas atualizar o `codigo_proposta` via reconciliação realtime/refetch após o INSERT.

### Parte C — Verificação

1. Reproduzir check-in via Recepção (busca por telefone) → conferir `pg_net._http_response` e logs do `trigger-webhook` (`[movimentacao-lead] 📤 dispatching`).
2. Reproduzir check-in via QR.
3. Reproduzir Kanban: Atribuído → Confirmado e Atribuído → Descartado.
4. Confirmar que move para `Convidado`/`Em Espera`/`Atribuído` continua sendo **skipped** (esperado).
5. Validar que `codigo_proposta` continua sendo persistido após resposta do MobiGestor (lógica intacta no edge).

## Não muda

- Regras de elegibilidade (canal Mensal/Grande Evento, status final, flag por empresa, exclusão de IA).
- Payload externo enviado ao MobiGestor.
- Captura/persistência de `codigo_proposta`.
- RLS, permissões, telas de Recepção/Kanban.
