# Pós-Vendas — Entregas

**Área:** Pós-Vendas
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Aba `/pos-vendas/entregas` — mesma ideia de [Peças](./pecas.md), mas com uma capacidade extra: **múltiplos templates sequenciais por gatilho** (Multi-Template). Cada slug pode ter uma **cadeia** ordenada de templates que são disparados um após o outro pela stack Paty (com regra de tempo no lado n8n).

## Fluxo funcional (para usuário)

1. Selecionar o agente Paty.
2. Para cada gatilho (card), ver a **lista ordenada** de "seguimentos":
   - Cada card interno = 1 template numa sequência (`sequencia = 1, 2, 3, ...`).
   - Toggle por card (Ativo/Inativo) — controla o gatilho inteiro (todos os seguimentos daquele slug).
   - Botão **+ Adicionar seguimento** cria uma nova linha (draft local; só persiste ao escolher template).
   - Botão **remover** apaga a linha e reordena — remoção é otimista (UI atualiza imediatamente).
3. Trocar template dentro de um seguimento envia `upsert-paty-entrega-template` com `sequencia` correspondente.

## Slugs fixos

Definidos em `ENTREGA_SLUGS_FIXOS` (`src/hooks/pos-vendas/useEntregasData.ts:14`):

```text
novo-lead-criacao
confirma-agendamento
entrega-confirmada
aviso-entrega-24h
MESSAGE_SENT_BEFORE_1H
MESSAGE_SENT_AFTER_1H
MESSAGE_SENT_AFTER_1D
```

Os slugs em UPPERCASE são gatilhos disparados **pela própria Paty** (não pelo SagaOne) quando o cliente responde ou o tempo passa.

## Detalhes técnicos

- **Páginas:** `src/pages/pos-vendas/EntregasGatilhos.tsx`, `EntregasLojas.tsx`.
- **Componente principal:** `src/components/pos-vendas/EntregasTab.tsx` — renderiza cards por slug, gerencia rows agrupadas, handlers `handleTemplateChange` / `handleToggleCard` / `addDraftSequencia` / `removeLocalRow`.
- **Hook:** `src/hooks/pos-vendas/useEntregasData.ts` (`usePatyEntregasTemplates`) — agrupa por `slug`, ordena por `sequencia`, mantém draft local com `sequencia = last + 1`, exporta `rowsBySlug: EntregaRowsBySlug`.
- **Select controlado:** `TemplateSelectApproved` — valor sempre string (nunca `undefined`) para evitar warning de controlled/uncontrolled do Radix Select.
- **Edge Function:** `external-webhook-proxy` com `endpoint`:
  - `upsert-paty-entrega-template` (`{ agente_telefone, empresa_id, gatilho, sequencia, template_id, ativo }`).
  - `get-paty-entrega-templates` — fetch inicial (agrupa e ordena).
- **Optimistic UI:** hook atualiza `rowsBySlug` **antes** do await do RPC — se der erro, o revert acontece no próximo refetch (não há rollback explícito). Escolha consciente para evitar bloqueio visual do usuário.

## Regras de negócio

- **Toggle no card = gatilho inteiro.** Não existe ativar apenas seguimento 2 — a Paty processa a cadeia toda ou nenhuma.
- **Sequência é 1-based e contínua.** Ao remover a linha do meio, o hook renumera. Não há gap.
- **Adicionar seguimento** cria linha local com `template_id=""`. Só persiste ao escolher template válido — draft não vai pro backend.
- **Slug sem nenhuma linha** = 1 row placeholder (sequencia 1, sem template) para permitir configuração inicial.
- **Campo `gatilho`** é sempre enviado (redundante com `slug`) — n8n roteia por `gatilho`.

## Erros comuns

| Sintoma | Causa | Ação |
|---------|-------|------|
| Warning "changing from uncontrolled to controlled" | Select recebeu `undefined` | Já corrigido em `TemplateSelectApproved.tsx` — valor cai para `""`. Se voltar, revisar o hook. |
| Toggle não muda estado ao clicar | Row com `template_id` vazio | Escolher template antes de ativar (validação no handler). |
| Cadeia disparou fora de ordem | Sequência inconsistente no backend Paty | Verificar `get-paty-entrega-templates` — se retornar sequências não-contíguas, renumerar manualmente. |
| Seguimento removido reaparece | Refetch trouxe do backend antes do upsert terminar | Aguardar; se persistir, é bug de race no n8n. |

## Relacionado

- [Peças](./pecas.md)
- [Paty Templates](./paty-templates.md)
- [Template pausado](../prospeccao/template-pausado.md)
- [Visão geral](./visao-geral.md)