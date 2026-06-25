## Diagnóstico

A feature **está ativa para HYUNDAI T9** (flag `webhook_movimentacao_lead = true`, empresa `e2c4fdf8...`), mas o webhook **não foi disparado** nos check-ins de hoje (14:55–14:58 BRT — Cirsa, Osnir e Gedeany).

Motivo: o webhook `movimentacao_lead_kanban` só é disparado quando a mudança de status passa por `Prospeccao.tsx → handleStatusChange` (drag-and-drop no Kanban). Os check-ins recentes foram registrados pelo fluxo da **Recepção** (QR scan / `RecepcaoModal`), que chama `useRecepcaoData → registrarCheckin` e `registrarCheckinMulti`. Esses dois caminhos:

- atualizam `contatos.status = 'Check-in'`,
- gravam `logs_movimentacao_contatos`,
- **mas NÃO invocam `trigger-webhook`** — por isso a Lambda do MobiGestor nunca é chamada.

Confirmação nos logs do Edge: zero invocações de `movimentacao_lead_kanban` no período. Confirmação no DB: os 3 contatos foram para Check-in mas não houve dispatch correspondente.

## O que mudar

Adicionar o disparo do webhook (fire-and-forget, igual ao Kanban) dentro do fluxo da Recepção, mantendo todas as validações server-side existentes (flag por empresa, canal Mensal/Grande Evento, status elegível, skip Pri IA).

### Arquivo: `src/hooks/useRecepcaoData.ts`

1. **`registrarCheckinMulti`** (após o `insert` em `recepcao_visitas`, dentro do `for`, quando `criados += 1`): invocar `supabase.functions.invoke('trigger-webhook', { body: { gatilho: 'movimentacao_lead_kanban', dados: { contato_id, empresa_id: activeCompany.id, prospeccao_id: match.prospeccao.id, status_anterior: 'Confirmado' /* ou null */, status_novo: 'Check-in', usuario_id: user?.id } } })` sem `await` bloqueante (try/catch silencioso, console.error em falha).

2. **`registrarCheckin`** (singular, fluxo legacy/QR direto): mesma chamada, usando `data.evento_id` como `prospeccao_id`.

Em ambos os casos:
- Não bloquear a UI — disparar em paralelo após o sucesso local.
- Usar `status_anterior` = `data.contato?.status ?? null` para refletir o que já é gravado em `logs_movimentacao_contatos`.
- Não filtrar canal/flag no client — o handler em `trigger-webhook`/`_shared/movimentacao-lead-webhook.ts` já faz isso e devolve `skipped: true` quando aplicável.

### O que NÃO mudar

- Nenhuma mudança no edge function `trigger-webhook` nem no helper `_shared/movimentacao-lead-webhook.ts` — a lógica do payload, captura de `codigo_proposta` e validações continuam funcionando.
- Nenhuma mudança no Kanban (`Prospeccao.tsx`) — já dispara corretamente.
- Nenhuma migration.

## Validação após implementar

1. Fazer check-in via Recepção em um lead de evento Mensal/Grande Evento da HYUNDAI T9.
2. Conferir nos logs do `trigger-webhook` a entrada `[movimentacao-lead] 📤 dispatching ...` com `status_novo: "Check-in"`.
3. Conferir no MobiGestor / n8n que a Lambda recebeu o payload.
4. Em empresa com a flag desligada (ex.: `SAGA - HYUNDAI T9`), conferir que o log mostra `flag_disabled` (skip esperado, sem erro).