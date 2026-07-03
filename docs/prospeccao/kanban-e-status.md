# Kanban e status do lead

**Área:** Prospecção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Tela `/prospeccao/atendimento` — quadro Kanban onde cada coluna é um valor de `contatos.status`. O usuário move o lead entre colunas via drag-and-drop; cada movimento grava `logs_movimentacao_contatos` e (quando aplicável) dispara webhook para o Mobi.

> **Débito arquitetural:** `contatos.status` é **global** — não é por evento. Um lead em `Check-in` num evento aparece `Check-in` em qualquer outro evento em que estiver vinculado. Isso infla métricas e causa disputas de escrita (race conditions). Está mapeado; mudança estrutural pendente.

## Fluxo funcional (para usuário)

**Colunas padrão** (esquerda → direita):

1. **Novo** — lead recém-importado, sem responsável.
2. **Atribuído** — atribuído a SDR/Vendedor (manual ou por [auto-atribuição](./atribuicao-sdr.md)).
3. **Contatado** — SDR abriu conversa.
4. **Em Espera** — aguardando decisão do cliente.
5. **Convidado** — confirmou interesse em ir ao evento.
6. **Check-in** — presente no evento (via [recepção](../recepcao/fluxo-checkin.md)).
7. **Venda** — fechou.
8. **Descartado** — sem interesse / número inválido.

**Filtros** disponíveis no topo:
- Evento (multi-select, obrigatório — Kanban **nunca** roda sem `prospeccaoIds` para evitar timeout 57014).
- Responsável, marca, temperatura, origem.
- Busca por nome/telefone.

**Regras de UX:**
- Botão "Contato Realizado" fica travado se o lead está bloqueado >24h (a menos que o destino seja Venda / Descartado).
- Ao criar/editar anotação, o registro vai em `contato_anotacoes` (pertence ao lead — não ao evento). `prospeccao_id` é metadado opcional.
- Timeline unificada em `contato_timeline` agrega logs de movimentação, anotações, chamadas e webhooks.

## Detalhes técnicos

- **Página:** `src/pages/Prospeccao.tsx` (3795 linhas — refactor pendente).
- **Hooks:** `useRecepcaoData`, `useContatoData`, `useAutoAtribuirLeads`, `useProspeccaoLogs`.
- **Tabelas:** `contatos`, `eventos_prospeccao`, `logs_movimentacao_contatos`, `contato_anotacoes`, `contato_timeline`.
- **RPCs:** carregamento otimista + agregação server-side (padrão descrito em [performance](../arquitetura/performance.md) *(pendente)*).
- **Mutação atômica de status:** `mutate_contato_status_atomic` — usada por `useContatoData` para evitar duplo trigger de webhook.
- **Webhook Mobi:** trigger PG `trg_dispatch_movimentacao_lead_webhook` em `logs_movimentacao_contatos` (única fonte — FE **não** invoca `trigger-webhook` para movimentação de Kanban). Contrato completo em [Sincronização MobiGestor](../arquitetura/sincronizacao-mobigestor.md).
- **Filtros padrão:** [`.lovable/memory/architecture/performance/kanban-default-filter-and-timeout-prevention`](../../.lovable/memory) — nunca chamar RPC sem `prospeccaoIds`.

## Regras de negócio

- Status **nunca regride** por integração automática (`create-lead-pri`, `bulk_upsert_contatos`) — só operações manuais ou de reset explícito regridem.
- Movimentações feitas pela Pri IA (`usuario_id = PRI_IA_USER_ID`) são silenciadas no dispatcher Mobi.
- Canais que **não** disparam webhook Mobi: qualquer canal fora de `{Mensal, Grande Evento}`, controlado por flag `webhook_movimentacao_lead` (per_empresa).

## Erros comuns

| Sintoma | Causa | Ação |
|---------|-------|------|
| Kanban trava / erro 57014 | Filtro sem `prospeccaoIds` | Selecionar ao menos um evento; ver memory `kanban-default-filter-and-timeout-prevention`. |
| Webhook Mobi disparado 2x | FE + trigger disparando | Confirmar que FE **não** chama `trigger-webhook` para `movimentacao_lead_kanban`. Trigger é a única fonte. |
| Métrica de check-in inflada | Status global | Débito conhecido; usar `DISTINCT contato_id` em agregações. |
| Botão "Contato Realizado" desativado | Lead bloqueado >24h | Só destravar para Venda/Descartado. |

## Relacionado

- [Atribuição SDR](./atribuicao-sdr.md)
- [Dispatch WhatsApp](./dispatch-whatsapp.md)
- [Fluxo check-in](../recepcao/fluxo-checkin.md)
- [Auditoria](./auditoria.md)