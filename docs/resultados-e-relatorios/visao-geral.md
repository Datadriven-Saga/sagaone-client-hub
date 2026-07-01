# Resultados & Relatórios — Visão Geral

**Área:** Resultados
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Área `/resultados` reúne **dashboards operacionais** (WhatsApp, Ligação, Kanban) e **relatórios** (convidados, vendas). Consumidores principais: gestores e equipes SDR/Vendas.

## Sub-módulos

| Rota | Módulo | Doc |
|---|---|---|
| `/resultados` | Dashboard consolidado (WPP + Ligação) | [dashboards.md](./dashboards.md) |
| `/resultados/relatorios` | Relatório de convidados e agregados | [relatorio-convidados.md](./relatorio-convidados.md) |

## Fonte de dados

- **WhatsApp:** contagem vem do **webhook** externo (memory `whatsapp-dashboard-data-source`), não da tabela local — evita divergência com Meta.
- **Ligação:** métricas em `agente_performance` + `vapi_calls_cache` + custos sync (memory `cost-management-sync-logic`).
- **Kanban / Vendas:** consultas diretas em `contatos` + `eventos_prospeccao` + `vendas_prospeccao`.

## Regras

- Agregações cross-empresa disponíveis só para Master/Admin (memory `admin-aggregated-dashboards`).
- Filtro padrão do Kanban por perfil (memory `kanban-default-filter-and-timeout-prevention`) — SDR só vê os leads da sua equipe.
- **Sempre `DISTINCT` em `contato_id`** para UI agregada (regra core).

## Relacionado

- [Dashboards](./dashboards.md)
- [Relatório de Convidados](./relatorio-convidados.md)
- [Logs de disparos](../prospeccao/logs-disparos.md)