# Relatório de Convidados

**Área:** Resultados
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Relatório em `/resultados/relatorios` que lista todos os leads convidados a eventos, com detalhamento de status, canal e resultado (compareceu, foi vendido, descartado). Base: `logs_movimentacao_contatos`.

## Fluxo funcional

1. Selecionar período e evento(s).
2. Sistema devolve tabela com contato, telefone, evento, status atual, primeiro contato, última movimentação, canal.
3. Exportação CSV.

## Detalhes técnicos

- **RPC:** `get_relatorio_convidados(p_empresa_id, p_prospeccao_ids uuid[], p_data_inicio, p_data_fim)`.
- **Fonte:** `logs_movimentacao_contatos` (canônica) + join com `contatos` e `eventos_prospeccao`.
- **Flag:** `relatorio_convidados_per_empresa` — libera o relatório por empresa (memory `relatorio-leads-convidados`).
- **RLS:** respeita visibilidade SDR (memory `lead-visibility-security-rules`).

## Regras

- **Um lead por linha por evento** (`DISTINCT contato_id, prospeccao_id`).
- Movimentações por IA (`usuario_id = PRI_IA_USER_ID`) aparecem no relatório mas são marcadas como origem "IA".
- Bloqueado para empresa sem flag ativa — toast "Recurso não habilitado".

## Relacionado

- [Visão geral Resultados](./visao-geral.md)
- [Kanban e status](../prospeccao/kanban-e-status.md)