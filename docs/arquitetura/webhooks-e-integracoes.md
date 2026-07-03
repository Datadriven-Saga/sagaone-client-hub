# Webhooks e Integrações Externas

**Área:** Arquitetura
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## Padrão

Toda integração externa passa por **Edge Function** ou **trigger PG + pg_net**. FE não chama URLs externas diretamente (CSP + segurança).

## Tokens

| Direção | Secret | Uso |
|---|---|---|
| Entrada (webhooks recebidos) | `SAGA_ONE_ADMIN_TOKEN` | Header `saga_one_supabase` |
| Saída (chamadas externas) | `SAGA_ONE` | Body/header em chamadas para n8n/MobiGestor |

Memory: `webhook-token-strategy`.

## Webhooks recebidos

| Edge | Origem | Doc |
|---|---|---|
| `template-paused-webhook` | Meta / SagaOne | [../prospeccao/template-pausado.md](../prospeccao/template-pausado.md) |
| `ia-ligacao-webhook` | Vapi / SagaOne | [../prospeccao/ia-ligacao.md](../prospeccao/ia-ligacao.md) |
| `atendimento-status-webhook` | MobiGestor | Atualiza status do lead |
| `confirm-presence` / `confirm-presence-info` | Convites externos | Confirma presença em evento |
| `dispatch-leads-webhook` | Lambda de disparo | Callback pós-envio |

## Webhooks enviados

| Trigger / Edge | Destino | Payload |
|---|---|---|
| `trg_dispatch_movimentacao_lead_webhook` (PG) → n8n `recebe-status-sagaone` | MobiGestor (via n8n) | Mudança de status de lead — **fonte única** (memory `movimentacao-lead-single-source`). Detalhes: [sincronizacao-mobigestor.md](./sincronizacao-mobigestor.md) |
| `external-webhook-proxy` (Edge) | n8n Paty | Peças / Entregas / Cadência (memory `external-api-proxy-and-csp-compliance`) |
| `process-campaign-job` → Lambda AWS | Meta WPP | Disparo em lote (memory `persistent-campaign-dispatch-system`) |
| `notify-evento-criado` | E-mail | Notificação de novo evento |

## Regras invariantes

- **Fonte única para movimentação:** FE/edges **não** invocam `trigger-webhook` para `movimentacao_lead_kanban`. Só o trigger PG dispara (memory `movimentacao-lead-single-source`).
- **Retry:** 3x com backoff em `external-webhook-proxy`; fallback GET quando POST falha por CORS (memory `resiliencia-edge-functions`).
- **Skip guards:** trigger não dispara se `usuario_id = PRI_IA_USER_ID` ou canal ∉ (`Mensal`, `Grande Evento`).
- **Meta compliance:** ao clonar template pausado, marcar `PAUSED` local e cancelar disparos futuros (memory `paused-template-webhook-compliance` + `pause-cancela-agendados`).

## Auditoria

- `template_pausado_audit` — toda chamada do webhook de pausa (mesmo payload inválido).
- `template_pausado_log` — chamadas válidas.
- `logs_disparos` — origem canônica dos envios WPP.
- `logs_movimentacao_contatos` — mudanças de status.

## Relacionado

- [Visão geral Arquitetura](./visao-geral.md)
- [APIs recebidas](../apis/webhooks-recebidos.md)
- [Sincronização MobiGestor](./sincronizacao-mobigestor.md)
- [Disparo WhatsApp](../prospeccao/dispatch-whatsapp.md)