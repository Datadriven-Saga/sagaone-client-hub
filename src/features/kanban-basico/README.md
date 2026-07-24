# Kanban Básico (v0)

MVP isolado do Kanban de Atendimento. Rota: `/prospeccao/atendimento-v2`.
Convive em paralelo com `/prospeccao/atendimento` — não substitui nada.

## Onde o lead vive

- **`contatos`**: a pessoa (1 por telefone dentro da empresa). Tem
  `contatos.status` (global — o mesmo para todos os eventos do lead).
- **`eventos_prospeccao`**: vínculo lead ↔ evento (mesmo nome da tabela de
  cadastro do evento — débito arquitetural conhecido).
- **`logs_movimentacao_contatos`**: cada mudança de status vira 1 linha
  `(contato_id, prospeccao_id, status_novo, autor, criado_em)`. É a única
  fonte confiável de "qual era o status desse lead **neste** evento".
- **`contato_anotacoes`**: histórico textual — pertence ao lead, não ao
  evento (o `prospeccao_id` é metadado opcional).

## Onde o "contato" (interação) vive

Não existe entidade `interacoes`. Um "contato realizado" hoje é
`logs_movimentacao_contatos` (a mudança de status) + `contato_anotacoes`
(o texto que o SDR escreveu), correlacionados por `contato_id`.

## Como o status é gerado (leitura)

```
contatos          logs_movimentacao_contatos          UI (coluna do Kanban)
  status  ─┐           por evento                         ▲
  (global) │              │                               │
           │              ▼                               │
           └──►  RPC get_kanban_columns(p_prospeccao_ids) ─┘
                    para cada lead no evento X:
                     último log em (contato_id, X)  → status daquele evento
                     se não houver log             → 'Novo'
                    agrupa por status → { coluna: {count, items[]} }
```

- Leitura: **por evento** (`get_kanban_columns` com `p_prospeccao_ids`).
  Sem `p_prospeccao_ids` a chamada é rejeitada para evitar timeout 57014.
- Escrita: `mutate_contato_status_atomic(contato, novo, anterior,
  prospeccao, usuario, obs)` — grava o log **e** atualiza
  `contatos.status`. Trigger PG dispara o webhook Mobi (única fonte).
  O FE **nunca** invoca `trigger-webhook` para movimentação.

## Colunas

Todos os 9 status atuais: Novo, Atribuído, Em Espera, Convidado,
Confirmado, Check-in, Venda, Descartado, Opt Out.

## Fora do MVP

Filtros de responsável/marca/temperatura, popover "Contato Realizado",
solicitar leads, anotações inline, bloqueio 24h, limite SDR, realtime.
Voltam como incrementos separados.