## Objetivo

Fazer com que a coluna "Status Lead" da tela `/prospeccao/eventos/:id/base` **e o Kanban** (`/prospeccao/atendimento`) mostrem o status do lead **naquele evento**, não o status global `contatos.status`. Sem alterar schema — deriva do último registro em `logs_movimentacao_contatos` filtrado por `prospeccao_id`.

## Diagnóstico

- `contatos.status` é global — 1 lead compartilha status entre eventos.
- `logs_movimentacao_contatos` tem `contato_id`, `prospeccao_id`, `status_novo`, `data_movimentacao`. 100% das linhas têm `prospeccao_id` preenchido (1.434.104 / 1.434.104). Base sólida para derivação.
- **Kanban também usa status global** — confirmado em `get_kanban_columns` e `get_contatos_paginated`: filtram por `c.status::text = v_status`.
- **Tela EventoBase (`src/pages/prospeccao/EventoBase.tsx` ~L910–978)** também lê `contatos.status` direto (`select('...status...')`, `.eq('status', statusFilter)`, contagem filtrada). Precisa entrar no escopo.

## Estratégia

Introduzir função SQL `get_contato_status_por_evento(contato_id, prospeccao_id) → text`:

- Retorna `status_novo` do log mais recente de `(contato_id, prospeccao_id)`.
- Fallback: `Novo` (status inicial ao vincular).
- `STABLE SECURITY DEFINER`, `search_path=public`.

Trocar leituras nas RPCs / queries que hoje usam `c.status` no contexto de "status neste evento".

## Escopo de mudança

### 1. Nova função SQL + índice
- `get_contato_status_por_evento(p_contato_id uuid, p_prospeccao_id uuid) returns text`.
- Índice composto: `logs_movimentacao_contatos (contato_id, prospeccao_id, data_movimentacao DESC)`.

### 2. Nova RPC para tela EventoBase
- `get_evento_base_contatos(p_empresa_id, p_prospeccao_id, p_limit, p_offset, p_search, p_status, p_disparo)`:
  - Devolve `{ total, contatos: [...] }`.
  - `status` de cada contato calculado pelo helper por evento.
  - Filtro de status aplicado sobre o status derivado.
  - Filtro `disparo` (`pendente`/`disparado`) preservado a partir de `eventos_prospeccao.data_disparo_ia`.
- Substituir a query direta em `EventoBase.tsx` (~L910–978) por essa RPC (tanto a listagem quanto a contagem, unificadas).

### 3. Kanban
- `get_kanban_columns` e `get_contatos_paginated`: computar `status` via helper por evento (CTE `pares` fazendo JOIN em `eventos_prospeccao` + `get_contato_status_por_evento`), e agrupar/filtrar por esse status derivado.
- Com filtro multi-evento, o mesmo lead pode aparecer em colunas diferentes (comportamento correto por evento). Documentar.
- Sem `p_prospeccao_ids` já é bloqueado pela regra `kanban-default-filter-and-timeout-prevention` — nada a fazer.

### 4. Dropdown de status
- `get_prospeccao_status_options`: passar a distinct de status derivado por evento (não mais `c.status`), garantindo que o filtro reflita o que existe naquele evento.

### 5. Escrita (mover lead / mudar status)
- Continua via `mutate_contato_status_atomic`: grava log com `prospeccao_id` e atualiza `contatos.status`. Nenhuma mudança de comportamento. `contatos.status` passa a ser apenas "último status conhecido em qualquer evento" e não é mais fonte de verdade da UI de leitura.

### 6. Webhook Mobi
- `trg_dispatch_movimentacao_lead_webhook` lê de `logs_movimentacao_contatos` — não afetado.

## Impactos e riscos

- **Métricas/relatórios** que hoje contam por `contatos.status` (ex.: `get_resumo_stats`, funil) continuam globais — fora do escopo desta fase.
- **Performance**: helper chamado por linha via CTE. Índice composto novo cobre o lookup (~O(log n)). Validar EXPLAIN em empresa grande (BMW MOTOS / FIAT SIA); se regressão, migrar para `DISTINCT ON` server-side em vez do helper por linha.
- **Duplicação visual no Kanban** com multi-evento: intencional.
- **Contatos sem log naquele evento**: fallback `Novo`.
- Reversível: basta reverter as RPCs.

## Validação obrigatória

1. Evento 1222 / BMW MOTOS: lead com status global ≠ status no evento → Base mostra status do evento.
2. Kanban com 1 evento filtrado: lead na coluna certa daquele evento.
3. Kanban com 2 eventos filtrados: lead com status divergente aparece 2x, um em cada coluna.
4. Mover lead: log com `prospeccao_id` correto, webhook Mobi 1x.
5. Filtro "Status" na Base filtra pelo status derivado.
6. Dropdown `get_prospeccao_status_options` reflete só status realmente presentes no evento.
7. EXPLAIN das novas RPCs sem regressão relevante.

## Fora de escopo

- `get_resumo_stats` e demais relatórios/funil por evento.
- Adicionar coluna `status` em `eventos_prospeccao` (caminho C).
- Limpeza de `contatos.status`.

## Confirmações antes de implementar

1. Ok deixar `contatos.status` como "último status em qualquer evento" (não é mais fonte de verdade da UI, mas continua sendo escrito para integrações)?
2. Ok o Kanban mostrar o mesmo lead em colunas diferentes quando filtrar múltiplos eventos com status divergentes?
3. Escopo desta fase: **Base + Kanban + dropdown de status**. Relatórios/funil ficam para depois. Confirma?
