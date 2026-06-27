## Objetivo

Adicionar campo opcional **"Vendedor que irá atender"** no modal de check-in da Recepção (FAB global / multi-prospecção). Quando preenchido, o nome (e e-mail, se houver correspondência) viaja no webhook `movimentacao_lead_kanban` em um novo par de campos, sem alterar o `email_vendedor` atual (que representa quem operou o sistema).

## Fluxo de preenchimento

- Combobox com busca dos vendedores da empresa ativa (profiles vinculados via `user_empresas` da empresa atual, filtrando perfis comerciais).
- Se a recepcionista achar pelo nome → seleciona → guardamos `nome` + `email`.
- Se digitar um nome que não bate com ninguém → mantém como texto livre → guardamos só `nome`, `email = null`.
- Campo é **opcional**: se vazio, nada novo vai no payload (compatibilidade total).

## Campos no webhook

Adicionar ao payload de `movimentacao_lead_kanban` (sem mexer em `email_vendedor`):

```json
{
  "vendedor_atendimento_nome":  "Fulano da Silva",
  "vendedor_atendimento_email": "fulano@empresa.com" // ou ""
}
```

Quando o campo do modal não for preenchido, ambos saem como `null`/ausentes — não regredir nenhum payload existente.

## Onde persistir (para o trigger PG ler)

O webhook `movimentacao_lead_kanban` hoje é disparado **exclusivamente** pelo trigger `trg_dispatch_movimentacao_lead_webhook` em `logs_movimentacao_contatos`. Para o trigger conseguir incluir os novos campos, precisamos persistir o vendedor na própria linha do log.

- Migration: adicionar a `public.logs_movimentacao_contatos`
  - `vendedor_atendimento_nome  text null`
  - `vendedor_atendimento_email text null`
- Atualizar o trigger `trg_dispatch_movimentacao_lead_webhook` para anexar esses dois campos ao body que vai para `trigger-webhook` quando não forem nulos.
- Atualizar `supabase/functions/_shared/movimentacao-lead-webhook.ts` para encaminhar `vendedor_atendimento_nome` / `vendedor_atendimento_email` ao endpoint externo (passa-through, sem afetar o resolver de `email_vendedor`).
- `recepcao_visitas`: nenhuma mudança de schema. (Posso espelhar o nome lá se você quiser histórico visível na listagem — confirmar depois.)

## Mudanças no frontend

1. `src/components/CheckinConfirmModal.tsx`
   - Novo bloco no fluxo multi (`isMulti`): label "Vendedor que irá atender (opcional)" + Combobox (shadcn `Command` + `Popover`) com busca por nome.
   - Estado local `vendedorAtendimento: { nome: string; email: string | null } | null`.
   - Permite digitar nome fora da lista → vira `{ nome, email: null }`.
   - Passa o objeto adiante via `onConfirmMulti(selectedIds, nomeVisitanteNovo, vendedorAtendimento)`.

2. `src/hooks/useRecepcaoData.ts`
   - Nova função `fetchVendedoresEmpresa()` retornando `[{ id, nome, email }]` da empresa ativa (join `user_empresas` + `profiles`, restrito a cargos comerciais — ex.: Vendedor, Gerente Comercial).
   - `registrarCheckinMulti(...)` ganha 4º arg `vendedor?: { nome: string; email: string | null }` e grava `vendedor_atendimento_nome/email` em cada `INSERT logs_movimentacao_contatos`.

3. `src/components/DashboardLayout.tsx`
   - Repassar o novo arg na chamada `registrarCheckinMulti`.
   - Carregar a lista de vendedores ao abrir o modal (lazy) e passar para o `CheckinConfirmModal`.

## Migrations (em uma migration única)

```sql
ALTER TABLE public.logs_movimentacao_contatos
  ADD COLUMN IF NOT EXISTS vendedor_atendimento_nome  text,
  ADD COLUMN IF NOT EXISTS vendedor_atendimento_email text;

-- recriar trg_dispatch_movimentacao_lead_webhook incluindo os 2 campos
-- no JSON enviado ao trigger-webhook (somente quando não nulos)
```

Sem mudança de RLS/GRANT (colunas novas em tabela existente).

## Edge functions a atualizar

- `supabase/functions/trigger-webhook/index.ts`: aceitar `vendedor_atendimento_nome` / `vendedor_atendimento_email` no body e passar para `_shared/movimentacao-lead-webhook.ts`.
- `supabase/functions/_shared/movimentacao-lead-webhook.ts`: incluir os dois campos no payload final POSTado ao endpoint MobiGestor.

## Fora de escopo (não tocar agora)

- QR Code (`registrarCheckin` single-event) e drag no Kanban — confirmado: só FAB global.
- Página `/recepcao` listagem — não exibir vendedor por enquanto.
- Webhooks que não sejam `movimentacao_lead_kanban`.

## Validação

- Check-in pelo FAB sem preencher vendedor → payload sai igual ao de hoje.
- Check-in pelo FAB selecionando vendedor da lista → payload traz `nome + email`.
- Check-in pelo FAB digitando nome novo → payload traz `nome` e `email: ""`.
- Conferir 1 invocação única em `function_edge_logs` para `trigger-webhook` (não regredir a dedupe do trigger PG).