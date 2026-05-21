# Unificar criação de lead pelo botão com o fluxo de importação

## Objetivo

Quando o vendedor clicar em "Criar Lead" no Kanban, o lead deve entrar no banco pelo **mesmo caminho** que um lead vindo do CSV, ou seja, via `bulk_upsert_contatos` — com toda a lógica de quarentena, opt-out, normalização, atribuição de responsável e vínculo em `eventos_prospeccao`.

Hoje o botão usa `create_lead_atomic`, que é um caminho paralelo. Vamos eliminar essa divergência.

## Mudanças

### 1. Edge function `create-lead`

Substituir a chamada de `create_lead_atomic` por `bulk_upsert_contatos` com um array de 1 item.

- Montar payload no mesmo formato do importador:
  - `nome`, `telefone` (já normalizado), `email`, `origem`, `observacoes`, `responsavel_email`
- Chamar `bulk_upsert_contatos(p_contatos, p_empresa_id, p_prospeccao_id, p_canal, p_force_status_novo)`:
  - `p_canal`: herdar de `prospeccoes.canal_quarentena` (default `whatsapp`)
  - `p_force_status_novo`: `false`
- Tratar a resposta:
  - `inserted` / `updated` / `linked` / `already_linked`
  - `quarantined` → devolver erro amigável tipo "Telefone em quarentena"
  - `global_blocked` → "Telefone em opt-out global"
  - `error_details` → 500 com detalhe
- Após sucesso, recuperar `lead_id` e `contato_id` para devolver no JSON (continuar disparando `trigger-webhook`).

### 2. Validações que ficam na edge

Continuar validando antes da RPC:
- Sessão / JWT
- `user_empresas` (acesso à empresa)
- Equipe do evento para vendedor
- Duplicidade (já tratada hoje, e também coberta pelo upsert)

### 3. Frontend

Sem mudança estrutural. O modal continua chamando a mesma edge function. Apenas ajustar mensagens de erro novas:
- quarentena
- opt-out global

### 4. Limpeza

Após validar que o botão funciona via `bulk_upsert_contatos`:
- Marcar `create_lead_atomic` como deprecated (não remover ainda, pode estar em outros lugares).
- Verificar se há outros chamadores antes de remover.

## Verificação

1. Vendedor cria lead novo pelo botão → conferir no banco:
   - `contatos` (criado com responsável)
   - `eventos_prospeccao` (vínculo no evento)
   - `contato_quarentena` (entrada criada igual ao import)
2. Vendedor tenta criar lead com telefone em quarentena → erro amigável.
3. Vendedor tenta criar lead com telefone existente → comportamento de duplicidade preservado.
4. Comparar 1 lead criado pelo botão com 1 lead criado por importação → mesmas colunas preenchidas, mesmas entradas auxiliares.

## Fora do escopo

- Não mexer no fluxo de importação.
- Não mexer no `NovoLeadModal` além de mensagens de erro novas.
- Não tocar em `create-lead-ligacao`.