# Dashboards

**Área:** Resultados
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Painéis em `/resultados` que consolidam performance operacional por canal (WhatsApp, Ligação) e por evento.

## Painéis

### WhatsApp

- KPIs: enviados, entregues, lidos, respondidos, custo estimado.
- **Fonte primária:** contagem devolvida pelo **webhook externo** (memory `whatsapp-dashboard-data-source`) — a tabela local `logs_disparos` é auditoria, não fonte de UI.
- Filtros: evento, template, período.

### Ligação (Vapi/Twilio)

- KPIs: chamadas, contatados (≥1 tentativa), duração média, custo total.
- **Fonte:** `agente_performance` (agregado) + `vapi_calls_cache` (detalhe).
- Custo sync via `fetch-vapi-metrics` / `fetch-twilio-metrics` / `fetch-call-costs` (memory `cost-management-sync-logic`).

### Kanban / Funil

- Distribuição de leads por status (`Novo`, `Contato`, `Agendamento`, `Check-in`, `Venda`, `Descartado`).
- Fonte: `contatos.status` + `eventos_prospeccao` (sempre `DISTINCT contato_id`).
- Paridade com filtros do Kanban (memory `kanban-funnel-sync-logic`).

## Cross-empresa (Admin)

Master/Admin/TI vêem agregações nacionais (memory `admin-aggregated-dashboards`) — mesma UI, sem filtro de empresa.

## Regras invariantes

- **Nunca** contar leads por `contatos` sem `DISTINCT` — infla números (memory core).
- Empresa sandbox excluída dos totais.
- Períodos default = últimos 30 dias.

## Relacionado

- [Visão geral Resultados](./visao-geral.md)
- [Monitor nacional](../administracao/monitor-disparos-nacional.md)
- [IA de Ligação](../prospeccao/ia-ligacao.md)