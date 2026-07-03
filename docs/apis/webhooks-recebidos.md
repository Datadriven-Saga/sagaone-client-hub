# Webhooks Recebidos

**Área:** APIs
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## Autenticação padrão

Todos os webhooks recebem o header:
```
saga_one_supabase: <SAGA_ONE_ADMIN_TOKEN>
```
Faltando ou incorreto → HTTP 403. (Bug histórico: usar `Authorization: Bearer ...` — errado.)

## Endpoints

### `template-paused-webhook`

Meta / SagaOne notifica que um template WPP foi pausado.

- **Ação:** trava o evento, seta `template_prospeccao_id = null`, cancela `campaign_jobs`/`campaign_batches` futuros, notifica dono do job.
- **Auditoria:** grava em `template_pausado_audit` (toda invocação, mesmo inválida) e `template_pausado_log` (válidas).
- **Detalhes:** [../prospeccao/template-pausado.md](../prospeccao/template-pausado.md).

### `ia-ligacao-webhook`

Vapi / SagaOne notifica evento de chamada (iniciada, atendida, concluída).

- **Ação:** upsert em `prospect_pri_voz`, incrementa métricas em `agente_performance`, atualiza `contatos.status` se atendida.
- **Detalhes:** [../prospeccao/ia-ligacao.md](../prospeccao/ia-ligacao.md).

### `atendimento-status-webhook`

> ⚠️ **Não é webhook recebido.** Está listado aqui por proximidade histórica de nome. Na verdade é uma edge de **saída**, chamada pelo FE (`src/hooks/useContatoData.ts`) quando um lead em campanha WhatsApp muda de status: envia payload com `telefone_pri`/`dealer_id` do agente ativo (`agentes_ia`) para o mesmo endpoint n8n `recebe-status-sagaone`, notificando o fluxo do agente Pri.
>
> Não recebe callback do MobiGestor. O gate `PRI_IA_USER_ID` do trigger de movimentação existe porque a Pri IA já atualiza o Mobi em paralelo — ver [Sincronização MobiGestor](../arquitetura/sincronizacao-mobigestor.md).

### `confirm-presence` / `confirm-presence-info`

Convite externo confirma presença do lead em um evento.

- **Ação:** move o lead para `Check-in`, grava em `logs_movimentacao_contatos`.
- **Idempotente por dia** (mesmo telefone+evento).

### `dispatch-leads-webhook`

Lambda AWS envia callback após tentativa de disparo WPP.

- **Ação:** grava em `logs_disparos` e `logs_disparos_falhas`, incrementa contador no `campaign_batches` correspondente.
- **Retry:** batches que voltam com falha entram em backoff (memory `persistent-campaign-dispatch-system`).

## Regras invariantes

- **Nunca** confiar apenas em HTTP 200 — verificar corpo do payload.
- Payload malformado é logado em `template_pausado_audit` (para pausa) ou descartado com 400 nos demais.
- Todos os webhooks são **idempotentes** (dedup por chave natural).

## Relacionado

- [Webhooks e integrações](../arquitetura/webhooks-e-integracoes.md)
- [`create-lead`](./create-lead.md)