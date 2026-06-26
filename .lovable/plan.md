## Objetivo

Restringir a busca por 4 últimos dígitos para retornar **apenas contatos vinculados a prospecções ativas** da loja, alinhando com o filtro já usado em `buscarContatoMultiAtivo` (`data_inicio <= now()` e `data_fim >= now() - 3 dias`).

## Mudanças

### 1. Migration: atualizar RPC `buscar_contatos_por_sufixo_telefone`

`CREATE OR REPLACE FUNCTION` (mantém assinatura `empresa_id uuid, sufixo text`):

- Mantém validação `user_can_access_empresa(empresa_id, auth.uid())`.
- Mantém uso do índice funcional `idx_contatos_tel_last4` no filtro de sufixo.
- Adiciona `EXISTS` em `eventos_prospeccao ep JOIN prospeccoes p ON p.id = ep.prospeccao_id` com:
  - `ep.contato_id = c.id`
  - `p.empresa_id = <empresa>`
  - `p.data_inicio <= now()`
  - `p.data_fim >= (now() - interval '3 days')`
- Retorna no máximo 50 contatos, ordenados por `nome`.
- `SECURITY DEFINER`, `SET search_path = public`.

Sem alteração de schema/grants (função já existe; só `CREATE OR REPLACE`).

### 2. Frontend

Nenhuma mudança em `useRecepcaoData.ts`, `DashboardLayout.tsx`, `Prospeccao.tsx` ou no picker — o contrato da RPC não muda, só o filtro interno.

Atualizar copy do helper text no `RecepcaoModal` para refletir o novo escopo:
- "🔎 Buscando pelos 4 últimos dígitos entre leads de eventos ativos da loja."

E mensagem do estado vazio no `RecepcaoMultiContatoPicker` (quando 0 resultados):
- "Nenhum lead encontrado com esses 4 dígitos em eventos ativos desta loja."

### 3. Documentação

Atualizar `docs/fluxo-checkin-recepcao.md` (seção 3) e o memory `mem://features/recepcao/fluxo-checkin.md` para deixar explícito que o sufixo já filtra por prospecção ativa (mesma janela do multi-ativo).

## Trade-off (confirmado pelo usuário implicitamente)

Leads sem evento vigente (ou com evento encerrado há mais de 3 dias) não aparecem mais nessa busca. Se a recepcionista precisar atender alguém nesses casos, usa o fluxo de telefone completo / novo visitante.
