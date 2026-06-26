---
name: movimentacao-lead-single-source
description: Único dispatcher do webhook movimentacao_lead_kanban é o trigger PG; FE/edges NÃO podem invocar trigger-webhook para esse gatilho
type: constraint
---

Disparo do webhook `movimentacao_lead_kanban` é feito **exclusivamente** pelo trigger PG `trg_dispatch_movimentacao_lead_webhook` (via `pg_net`) no INSERT em `logs_movimentacao_contatos`.

**Proibido** chamar `supabase.functions.invoke('trigger-webhook', { gatilho: 'movimentacao_lead_kanban' })` (ou `fetch` equivalente) a partir de:
- FE (`useRecepcaoData.registrarCheckin` / `registrarCheckinMulti`, Kanban, etc.)
- Edges que também inserem em `logs_movimentacao_contatos` (`confirm-presence`, `prospeccao-status` quando vier a inserir)

**Why:** disparo duplicado (visto em 26-jun-2026: dois `Succeeded` no mesmo segundo para o mesmo payload). O trigger PG foi adicionado para resolver race condition de FE que abortava ao fechar modal; as chamadas FE/edge ficaram redundantes.

**Fallback `email_vendedor`:** quando `usuario_id IS NULL` (caminho público de `confirm-presence`), o trigger PG lê `contatos.responsavel_email` e injeta no payload — não é mais necessário chamar `dispararMovimentacaoLeadKanban` direto da edge para preservar atribuição.