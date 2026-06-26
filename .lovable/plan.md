
## Diagnóstico do lead D7F0D57A

**Não foi o usuário** convidando/confirmando 2x. É **duplicação no sistema**, gerada pelo próprio Kanban.

### Evidência (logs_movimentacao_contatos)

Cada movimentação aparece como **par**, mesmo `usuario_id`, mesma transição, com ~180ms de diferença:

| ts | status | observacoes |
|---|---|---|
| 17:59:19.676 | Em Espera → Confirmado | `auto-trigger (fallback de migracao)` |
| 17:59:19.859 | Em Espera → Confirmado | `NULL` |
| 17:59:20.906 | Confirmado → Convidado | `auto-trigger (fallback de migracao)` |
| 17:59:21.088 | Confirmado → Convidado | `NULL` |

E os mesmos pares aparecem nas mudanças de 7 dias atrás (Novo→Atribuído, Atribuído→Em Espera) — sempre que o usuário move pelo Kanban.

### Causa raiz

`Prospeccao.tsx → executeKanbanStatusChange` faz **duas** escritas para cada drag-and-drop:

1. `atualizarStatusContato` (em `useContatoData.ts:1090`) → `supabase.from('contatos').update({ status })` direto.
   - Dispara o trigger defensivo `trg_log_contato_status` (migração `20260519195455`), que **não** vê a flag `app.status_change_logged` (a flag só é setada pelo RPC `mutate_contato_status_atomic`) → **INSERT 1** com obs `auto-trigger (fallback de migracao)`.
2. `logStatusChange` → `registrarMovimentacao` (`useProspeccaoLogs.ts`) → INSERT direto em `logs_movimentacao_contatos` → **INSERT 2** com obs `NULL`.

Cada INSERT em `logs_movimentacao_contatos` dispara `trg_dispatch_movimentacao_lead_webhook` (única fonte de sync MobiGestor, conforme memória `movimentacao-lead-single-source`). Por isso o webhook saiu 2x — exatamente o sintoma reportado.

O `contatoStatusApi.ts` já documenta que "`supabase.from('contatos').update({ status })` é proibido — use sempre `setContatoStatus`", mas o Kanban nunca foi migrado (era um dos PRs pendentes "1-4" mencionados no comentário do arquivo).

---

## Plano de correção

### Passo 1 — Migrar `executeKanbanStatusChange` para `setContatoStatus`

Em `src/pages/Prospeccao.tsx`:

- Substituir `atualizarStatusContato(itemId, novoStatusDb)` por `setContatoStatus({ contatoId, novoStatus, prospeccaoId, observacoes, skipWebhooks: true })`.
- `skipWebhooks: true` porque o webhook `movimentacao_lead_kanban` é disparado pelo trigger PG após o INSERT do log; não queremos o webhook `alteracao_status_contato` do `prospeccao-status`.
- Resolver `prospeccaoId` igual ao `logStatusChange` faz hoje (filtro ativo > vínculos do lead > fallback).
- **Remover** a chamada `logStatusChange(itemId, fromStatus, toStatus)` — o próprio RPC `mutate_contato_status_atomic` já grava o log (com a flag setada, suprimindo o fallback).
- Atualizar localmente o `setContatos` (hoje feito dentro de `atualizarStatusContato`) para preservar a UX otimista.

### Passo 2 — Aplicar mesma migração nos outros call sites do Kanban

Mesma substituição (RPC atômico via `setContatoStatus`, sem `logStatusChange` redundante) em:

- `Prospeccao.tsx:1394` (Venda quick-action)
- `Prospeccao.tsx:1452` (handleStatusChange genérico)
- `Prospeccao.tsx:2227, 2240, 2308, 2320, 2460` (descartes/atribuições/convites/vendas)
- `Prospeccao.tsx:3560, 3607, 3634` (Descartado/Convidado pós-modais)

Em cada caso, conferir se o observacoes hoje passado para `logStatusChange` precisa virar `observacoes` do `setContatoStatus`.

### Passo 3 — Marcar `atualizarStatusContato` como deprecated

Em `src/hooks/useContatoData.ts`, manter a função para outros call sites por enquanto, mas adicionar comentário deprecando e apontando para `setContatoStatus`. Não remover ainda — fora do escopo desta correção.

### Passo 4 — Validação manual

1. Mover um lead de teste no Kanban e verificar em `logs_movimentacao_contatos`:
   - **1 linha** por movimentação, com `observacoes` real (não `auto-trigger ...`).
2. Verificar logs do `trigger-webhook` (Edge): **1 invocação** por movimentação, não 2.
3. Conferir que o status do contato e o histórico de Anotações/Histórico no modal continuam corretos.

### O que NÃO alterar

- Trigger `trg_log_contato_status` e função `log_contato_status_change` — continuam como rede de segurança para call sites legados (recepção, modais, etc.) que ainda fazem `.update({ status })` direto.
- Função `mutate_contato_status_atomic`, edge `prospeccao-status`, trigger `trg_dispatch_movimentacao_lead_webhook` — todas já estão corretas; o problema é só o caller no Kanban.
- `useContatoData.atualizarStatusContato` — manter funcionando para evitar regressão em telas que ainda dependem dela.

### Resposta direta à pergunta

Não, o usuário não confirmou/convidou 2x no mesmo segundo. Cada ação do Kanban gerava **dois INSERTs** em `logs_movimentacao_contatos` (um do trigger defensivo, um do `registrarMovimentacao` explícito), e como o webhook MobiGestor é disparado por INSERT nessa tabela, ele saiu 2x. A correção é migrar o Kanban para o RPC atômico que já existe (`mutate_contato_status_atomic`, via `setContatoStatus`).
