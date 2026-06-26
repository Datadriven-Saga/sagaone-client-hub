# Fluxo de Check-in — Recepção

Documento de referência do fluxo de check-in de leads no SagaOne. Atualizado em 2026-06-26.

## 1. Pontos de entrada

| Origem | Componente | Hook / Handler | Modo |
|---|---|---|---|
| FAB global (todas as telas) | `DashboardLayout` → `RecepcaoModal` | `useRecepcaoData.buscarContatoMultiAtivo` | Multi-prospecção ativa |
| QR Code | `QRCodeScanner` em `/recepcao` | `useRecepcaoData.registrarCheckin` | Single-event |
| Kanban (drag) | `Prospeccao.tsx` | Update `contatos.status` + `logs_movimentacao_contatos` | Single-event |
| Página `/recepcao` | `RecepcaoTable` | `fetchVisitas` (listagem) | Read-only |

## 2. Fluxo "Buscar por telefone" (multi-prospecção)

`useRecepcaoData.buscarContatoMultiAtivo(telefone)`:

1. Lista prospecções da empresa com `data_inicio <= now()` e `data_fim >= now() - 3 dias` (tolerância para eventos recém-encerrados).
2. Gera variações do telefone via `phoneUtils.generatePhoneVariations` (9º dígito + DDI 55) e busca `contatos` com `telefone IN (...)` filtrando depois por `phonesMatch` para tolerar formatações.
3. Busca vínculos em `eventos_prospeccao` (deduplicados por par `contato_id+prospeccao_id`).
4. Conta `totalLeads` por prospecção e monta `MultiCheckinData`.

## 3. Fluxo "Buscar pelos 4 últimos dígitos" (novo)

`useRecepcaoData.buscarContatosPorSufixo(sufixo)`:

1. Chama RPC `buscar_contatos_por_sufixo_telefone(empresa_id, sufixo)` (SECURITY DEFINER, valida acesso à empresa).
2. RPC usa índice funcional `idx_contatos_tel_last4` em `right(regexp_replace(telefone,'\D','','g'), 4)`.
3. Retorna até 50 contatos.

No `DashboardLayout.handleRecepcaoSearch`:
- 0 resultados → abre picker com mensagem "Nenhum contato encontrado".
- 1 resultado → segue direto para `buscarContatoMultiAtivo(telefone_real)`.
- N resultados → abre `RecepcaoMultiContatoPicker`; após escolher, segue o fluxo multi-prospecção.

## 4. Confirmação (`CheckinConfirmModal` → `registrarCheckinMulti`)

- Pré-seleciona a prospecção com **maior base** entre as que já têm o contato (fallback: maior base geral).
- Para cada prospecção selecionada:
  - **Novo**: cria `contatos` (status Check-in) + insere `eventos_prospeccao (tipo=Contato Inicial)`.
  - **Existente**: `UPDATE contatos.status='Check-in'`.
  - **Idempotência**: se já existe `recepcao_visitas` para telefone+evento no dia → pula.
  - Insere `logs_movimentacao_contatos` e `recepcao_visitas`.
  - Dispara webhook `movimentacao_lead_kanban` (fire-and-forget no FE).

## 5. Fluxo QR Code (`registrarCheckin`)

Single-event: `verificarCheckinExistente` → cria/atualiza contato → log → visita → webhook.

## 6. Efeitos colaterais

- `logs_movimentacao_contatos` aciona o trigger `trg_dispatch_movimentacao_lead_webhook` (server-side via `pg_net`) → edge function `trigger-webhook` (header `saga_one_supabase`) → Lambda MobiGestor.
- O webhook só é disparado para empresas com a feature flag `webhook_movimentacao_lead` ativa, e apenas para eventos **Mensal** ou **Grande Evento** (validação dentro da edge function).
- `contatos.status` é **global** (não por evento) — débito conhecido. Atualizar para `Check-in` reflete em todas as prospecções do lead.
- `eventos_prospeccao` aceita múltiplas linhas por par; sempre dedupe na leitura.

## 7. Permissões

- Acesso à Recepção / QR scanner restrito a Admin e Recepcionista.
- RLS de `recepcao_visitas` por `empresa_id`.
- RPC `buscar_contatos_por_sufixo_telefone` valida `user_can_access_empresa(empresa_id, auth.uid())`.

## 8. Diagrama

```text
[FAB] -> RecepcaoModal
           |
      input >=10  +---->  buscarContatoMultiAtivo
           |                       |
      input ==4   +---->  buscarContatosPorSufixo
                          |
                          +-- 0   -> picker vazio
                          +-- 1   -> usa telefone real -> multi
                          +-- N   -> RecepcaoMultiContatoPicker -> multi
                                                                       |
                                                                       v
                                                          CheckinConfirmModal
                                                                       |
                                                                       v
                                                          registrarCheckinMulti
                                                                       |
                                  contatos  logs_movimentacao  recepcao_visitas
                                                                       |
                                                             trigger PG (flag)
                                                                       |
                                                            trigger-webhook
                                                                       |
                                                           Lambda MobiGestor
```