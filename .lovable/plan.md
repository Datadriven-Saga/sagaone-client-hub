## Objetivo

Fazer com que a coluna "Status Lead" da tela `/prospeccao/eventos/:id/base` **e o Kanban** (`/prospeccao/atendimento`) mostrem o status do lead **naquele evento**, não o status global `contatos.status`. Sem alterar schema — deriva do último registro em `logs_movimentacao_contatos` filtrado por `prospeccao_id`.

## Diagnóstico (feito antes do plano)

- `contatos.status` é global — 1 lead compartilha status entre eventos.
- `logs_movimentacao_contatos` tem `contato_id`, `prospeccao_id`, `status_novo`, `data_movimentacao`. 100% das linhas têm `prospeccao_id` preenchido (1.434.104 / 1.434.104). Base sólida para derivação.
- **Kanban também usa status global** — confirmado em `get_kanban_columns` (linhas 33, 55) e `get_contatos_paginated`: filtram por `c.status::text = v_status`, então um lead em evento A aparece na mesma coluna que estiver globalmente. É o mesmo bug arquitetural, só que no Kanban ele fica mascarado porque o usuário quase sempre filtra 1 evento por vez.

## Estratégia

Introduzir função SQL `get_contato_status_por_evento(contato_id, prospeccao_id) → text`:

- Retorna `status_novo` do log mais recente de `(contato_id, prospeccao_id)`.
- Se não houver log para aquele evento, usa fallback: `Novo` (é o status inicial ao vincular via `eventos_prospeccao`).
- `STABLE SECURITY DEFINER`, `search_path=public`.

Depois trocar as leituras nas RPCs/queries que hoje consultam `c.status` no contexto de "status neste evento".

## Escopo de mudança

### 1. Nova função SQL
```
get_contato_status_por_evento(p_contato_id uuid, p_prospeccao_id uuid) returns text
```
+ índice de suporte se ainda não existir: `logs_movimentacao_contatos (contato_id, prospeccao_id, data_movimentacao desc)`.

### 2. Tela Base (`/prospeccao/eventos/:id/base`)
- `src/pages/prospeccao/EventoBase.tsx` (~L910–930): substituir `select('...status...')` de `contatos` por join/RPC que devolva o status por evento. Opções:
  - **a)** RPC dedicada `get_evento_base_contatos(p_prospeccao_id, filtros...)` que já resolve o status por evento no servidor (preferido — evita N+1).
  - **b)** manter query atual mas trocar `c.status` por subquery lateral em `logs_movimentacao_contatos`.
- Filtro do dropdown "Status" precisa filtrar pelo status derivado (não pelo global).
- Popular dropdown continua via `get_prospeccao_status_options` (já é por evento — validar).

### 3. Kanban (`/prospeccao/atendimento`)
- `get_kanban_columns` e `get_contatos_paginated`: trocar `c.status::text = v_status` por comparação com o status derivado do log mais recente **daquele `prospeccao_id`** (usando `p_prospeccao_ids`).
- Quando `p_prospeccao_ids` tiver mais de 1 evento: o lead aparece em cada evento com seu próprio status (pode aparecer duplicado entre colunas se o mesmo lead estiver em 2 eventos com status diferentes — este é o comportamento **correto** por evento; hoje aparece 1x com status global). Documentar.
- Sem `p_prospeccao_ids` (visão "todos os eventos"): já é bloqueado pela regra `kanban-default-filter-and-timeout-prevention`, então não precisa tratar.

### 4. Escrita (mover lead / mudar status)
- Continua gravando em `logs_movimentacao_contatos` com `prospeccao_id` (já é o padrão via `mutate_contato_status_atomic`). **Não** mudar `contatos.status` como parte deste caminho — ou seja, ele passa a ser "último status conhecido em qualquer evento" e não é mais fonte de verdade da UI.
- Auditar `mutate_contato_status_atomic`: garantir que continua atualizando `contatos.status` (para compatibilidade com integrações e webhook Mobi) **e** inserindo log com `prospeccao_id` correto. Nenhuma mudança de comportamento aqui.

### 5. Webhook Mobi
- Dispatcher `trg_dispatch_movimentacao_lead_webhook` lê de `logs_movimentacao_contatos` — não afetado.

## Impactos e riscos

- **Métricas / relatórios** que hoje contam por `contatos.status` (ex.: `get_resumo_stats`, funil) continuarão globais até serem migradas. Fora do escopo desta fase. Documentar como próximo passo.
- **Performance**: leitura por evento vira `DISTINCT ON (contato_id, prospeccao_id) ... ORDER BY data_movimentacao DESC`. Precisa índice composto. Validar com EXPLAIN em BMW MOTOS e FIAT SIA (bases grandes).
- **Duplicação visual no Kanban** com filtro multi-evento: intencional. Alinhar com usuário antes de subir.
- **Contatos sem log naquele evento**: fallback `Novo`. Validar contra `eventos_prospeccao` para casos legados.
- Nada de mudança de schema. Reversível trocando as RPCs de volta.

## Validação obrigatória (pré-deploy)

1. Evento 1222 / BMW MOTOS: reproduzir cenário original (lead com status global ≠ status no evento) e confirmar que a Base mostra o status do evento.
2. Kanban com 1 evento filtrado: lead aparece na coluna certa daquele evento.
3. Kanban com 2 eventos filtrados: lead com status diferente entre eventos aparece 2x, um em cada coluna.
4. Mover lead no Kanban → confere log com `prospeccao_id` correto, webhook Mobi disparado 1x.
5. Filtro "Status" na Base filtra pelo status derivado.
6. EXPLAIN das novas RPCs em empresa grande — sem regressão >20%.
7. `get_prospeccao_status_options` continua populando corretamente.

## Fora de escopo (fica para próximas fases)

- Migrar `get_resumo_stats` e demais relatórios para status por evento.
- Adicionar coluna `status` em `eventos_prospeccao` (débito estrutural — caminho C).
- Reset/limpeza de `contatos.status` global.

## Confirmações necessárias antes de eu implementar

1. Ok deixar `contatos.status` como "último status em qualquer evento" (não é mais fonte de verdade da UI, mas continua sendo escrito para integrações)?
2. Ok o Kanban passar a mostrar o mesmo lead em colunas diferentes quando filtrar múltiplos eventos com status divergentes?
3. Escopo desta fase: **só Base + Kanban**. Relatórios/funil ficam para depois. Confirma?
