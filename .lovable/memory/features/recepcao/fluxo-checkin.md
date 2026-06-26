---
name: fluxo-checkin
description: Fluxo de check-in (FAB/QR/Kanban), busca multi-prospecção, busca por 4 últimos dígitos, webhook MobiGestor
type: feature
---

## Pontos de entrada
- FAB global (`DashboardLayout` → `RecepcaoModal`): busca multi-prospecção.
- QR (`/recepcao`): single-event via `registrarCheckin`.
- Kanban: drag-and-drop atualiza `contatos.status`.

## Busca
- **Telefone completo (10-11 dígitos)** → `buscarContatoMultiAtivo`: lista prospecções ativas (`data_inicio <= now <= data_fim + 3d`) e tenta match por variações (9º dígito, DDI 55).
- **4 últimos dígitos** → `buscarContatosPorSufixo` chama RPC `buscar_contatos_por_sufixo_telefone(empresa_id, sufixo)` (índice `idx_contatos_tel_last4`). 1 resultado segue direto; N abrem `RecepcaoMultiContatoPicker`.

## Confirmação (`registrarCheckinMulti`)
- Pré-seleciona a prospecção com maior base.
- Idempotência por dia: pula se já há `recepcao_visitas` desse telefone+evento hoje.
- Insere `logs_movimentacao_contatos` + `recepcao_visitas` + atualiza `contatos.status='Check-in'`.

## Webhook MobiGestor
- Trigger PG `trg_dispatch_movimentacao_lead_webhook` em `logs_movimentacao_contatos` chama `trigger-webhook` via `pg_net` com header `saga_one_supabase`.
- Gated pela flag `webhook_movimentacao_lead` (per_empresa) e por tipo de evento (Mensal/Grande Evento).

## Doc completa
`docs/fluxo-checkin-recepcao.md`