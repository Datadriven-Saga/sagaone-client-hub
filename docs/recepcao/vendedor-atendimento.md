# Vendedor de Atendimento no Check-in

**Área:** Recepção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Campo **opcional** no check-in que registra qual vendedor irá atender o cliente. É enviado ao MobiGestor via webhook de mudança de status para que o CRM externo abra o atendimento com o vendedor correto.

## Fluxo funcional

1. Recepcionista confirma o check-in.
2. Combobox **"Vendedor que irá atender"** lista vendedores ativos da loja (RPC `get_vendedores_atendimento`).
3. Recepcionista pode:
   - Escolher da lista.
   - Digitar (autocomplete) — **Enter** confirma a seleção destacada; se nada estiver destacado, ignora o Enter (não abre dropdown).
   - Deixar em branco — nesse caso o vendedor virá do responsável do lead.
4. Ao salvar, os campos `vendedor_atendimento_nome` e `vendedor_atendimento_email` viajam no payload do webhook.

## Detalhes técnicos

- **Colunas:** `logs_movimentacao_contatos.vendedor_atendimento_nome`, `vendedor_atendimento_email`.
- **RPC:** `get_vendedores_atendimento(p_empresa_id uuid)`.
- **UI:** `CheckinConfirmModal.tsx` — combobox com autocomplete que **não abre dropdown no Enter**.
- **Webhook:** `trigger-webhook` mapeia esses campos para `vendedor_atendimento_nome` e `email` no payload MobiGestor.
- **Fallback:** se o campo estiver vazio, o edge usa o responsável atual do lead.

## Regras

- O trigger PG `trg_dispatch_movimentacao_lead_webhook` é a **fonte única** do disparo. `atualizarStatusSemLogAutomatico` no FE evita duplicar o log e permite que o vendedor selecionado tenha prioridade sobre o responsável antigo.
- E-mail é normalizado para lowercase antes de sair.

## Erros comuns

| Sintoma | Causa | Ação |
|---|---|---|
| Vendedor não chega no MobiGestor | Log foi criado sem os campos (fluxo antigo) | Confirmar uso de `atualizarStatusSemLogAutomatico` |
| Combobox vazia | RPC `get_vendedores_atendimento` sem retorno | Conferir vendedores ativos na empresa |
| Nome errado enviado | Autocomplete pegou item errado no Enter | Comportamento corrigido — Enter só confirma item destacado |

## Relacionado

- [Fluxo de check-in](./fluxo-checkin.md)
- [Sincronização MobiGestor](../arquitetura/sincronizacao-mobigestor.md) — webhook de movimentação de lead