# Recepção — Visão Geral

**Área:** Recepção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Módulo usado por recepcionistas em loja para registrar **check-ins** de clientes em eventos ativos e atribuí-los a um vendedor.

## Pontos de entrada

| Origem | Componente | Observação |
|---|---|---|
| **QR Code** | `RecepcaoModal` (via `/recepcao/qr`) | Cliente escaneia o QR; se o telefone já está em evento ativo, é reconhecido. |
| **FAB** (botão flutuante) | `RecepcaoModal` em `/prospeccao` | Recepcionista abre pela tela de Kanban. |
| **Kanban direto** | `CheckinConfirmModal` no card | Move o lead direto para `Check-in`. |

## Fluxo funcional (para usuário)

1. Recepcionista digita o **telefone** (mínimo 4 dígitos finais) ou faz busca por nome.
2. Sistema traz **contatos ativos** naquela loja (RPC `buscar_contatos_por_sufixo_telefone`).
3. Se houver múltiplos, `RecepcaoMultiContatoPicker` mostra a lista com telefone completo e permite editar o nome inline.
4. Se não existir, cria um lead novo no evento selecionado.
5. Confirma o check-in — opcionalmente informa o **vendedor que irá atender** (combobox com autocomplete).
6. Sistema dispara webhook MobiGestor (via trigger PG) para sincronização externa.

## Regras de acesso

- QR Scanner: `Admin`, `Recepcionista` (memory `recepcao-access-roles`).
- FAB / Kanban: qualquer perfil com `canAccessProspeccao`.

## Detalhes técnicos

- **Páginas / componentes:** `src/pages/Recepcao*.tsx`, `src/components/recepcao/*`, `RecepcaoModal.tsx`, `CheckinConfirmModal.tsx`, `RecepcaoMultiContatoPicker.tsx`.
- **Hook:** `src/hooks/useRecepcaoData.ts`.
- **Tabelas:** `recepcao_visitas`, `contatos`, `eventos_prospeccao`, `logs_movimentacao_contatos`.
- **RPCs:** `buscar_contatos_por_sufixo_telefone`, `get_vendedores_atendimento`, `atualizarStatusSemLogAutomatico`.
- **Webhook out:** trigger PG `trg_dispatch_movimentacao_lead_webhook` — **fonte única** (memory `movimentacao-lead-single-source`). FE não invoca `trigger-webhook` para `movimentacao_lead_kanban`.
- **Gate:** flag `webhook_movimentacao_lead` (por empresa).

## Regras invariantes

- Idempotência diária por telefone+evento (evita check-in duplicado no mesmo dia).
- Webhook não é disparado quando `usuario_id = PRI_IA_USER_ID` ou canal ∉ (`Mensal`, `Grande Evento`).
- Nome pode ser editado inline no picker; a atualização persiste em `contatos.nome`.
- E-mail do responsável é sempre normalizado para lowercase (trigger `trg_normalize_responsavel_email`).

## Relacionado

- [Fluxo de check-in (detalhado)](./fluxo-checkin.md)
- [Busca por sufixo de telefone](./busca-sufixo-telefone.md)
- [Vendedor de atendimento](./vendedor-atendimento.md)