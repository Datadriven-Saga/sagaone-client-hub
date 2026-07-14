## Objetivo

Depois que o SDR confirma "Sim" no diálogo de **Contato Realizado** no card do Kanban, permitir que ele **mova o lead direto para qualquer coluna existente do Kanban**, sem passar por uma etapa intermediária de "vai participar / não vai participar / etc.".

## Fluxo novo

1. SDR clica no ícone de telefone no `KanbanCard`.
2. Confirma **"Sim, realizei o contato"** → contagem de chamadas incrementa normalmente (comportamento atual preservado).
3. Em vez de fechar o diálogo, ele passa para um segundo passo mostrando **as colunas do Kanban atual** como botões (as mesmas que já existem hoje — nada de opções fixas novas).
4. SDR escolhe a coluna destino → o lead é movido, respeitando as regras atuais (lock de 24h, limite de 30 leads, permissões).
5. Opção **"Fechar sem mover"** para o caso de só registrar a ligação.

## Impacto

- **Banco / tabelas**: nenhuma mudança de schema. Reusa o que já existe:
  - `contatos.status` (via caminho atual de mover lead no Kanban).
  - `logs_movimentacao_contatos` (log de movimentação já disparado hoje).
  - Contagem de ligação: mesmo fluxo atual de "contato realizado".
- **Regras preservadas**:
  - Lock de 24h entre movimentações.
  - Limite de 30 leads por SDR.
  - Visibilidade / ownership do lead.
  - Log de auditoria idêntico ao de mover manualmente.
- **Código afetado (frontend apenas)**:
  - `src/components/kanban/KanbanCard.tsx` — transformar o `AlertDialog` de contato realizado em fluxo de 2 passos.
  - Reusar o handler existente de movimentação de lead do Kanban (mesma função chamada quando o SDR arrasta o card), passando o `status` destino escolhido.
  - Obter a lista de colunas do próprio contexto do Kanban (não hardcode) — assim, se as colunas mudarem, o diálogo acompanha automaticamente.

## Fora de escopo

- Nenhuma nova coluna, status ou regra de negócio.
- Nenhum novo webhook.
- Nenhuma mudança em RPC, RLS ou tabela.

## Ponto a confirmar

Ao mover pelo diálogo, deve ser exatamente equivalente ao **arrastar o card** (mesmo log, mesmas validações). Confirma?
