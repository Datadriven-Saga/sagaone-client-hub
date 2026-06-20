# Fluxo de Template Pausado pela Meta

> Acionado quando a Meta marca um template de WhatsApp como `PAUSED`.
> Lambda externa notifica o SagaOne via `template-paused-webhook`.
> Validado em produção em jun/2026 (`id_meta=4420455864866490`).

## Entrada

Lambda chama `POST /functions/v1/template-paused-webhook` com:

```json
{ "id_meta": "<id_meta_do_template_pausado>" }
```

## Passos executados (`supabase/functions/template-paused-webhook/index.ts`)

1. **Lock atômico em `template_pausado_log`** via índice único parcial em
   `id_meta_original WHERE status NOT IN ('failed','resolved','cancelled')`.
   Impede recovery duplicado. Conflito → retorna sucesso com
   `ignored_duplicate_request`.
2. Marca todos os `whatsapp_templates` com aquele `id_meta` como
   `status_meta = 'PAUSED'`.
3. Para cada um dos 5 `TEMPLATE_FIELDS` em `prospeccoes`
   (`template_prospeccao_id`, `template_agendado_id`,
   `template_nao_agendado_id`, `template_agendado_48h_id`,
   `template_agendado_24h_id`) com `canal ILIKE '%whatsapp%'`:
   **desassocia** o campo (`NULL`) e seta `disparos_pausados = true`.
   Bloqueia novos disparos até template aprovado ser vinculado.
4. **Cancela** todos os `campaign_jobs` em `pending`/`processing` das
   prospeccoes afetadas, com
   `error_message='Template pausado pela Meta'`.
5. **Duplica o template por empresa** com nome `<base>_v<N+1>`, body com
   `tweakBodyText`, chamando `trigger-webhook → novo_template_whatsapp`.
   Se a Meta não devolver `template_id_pri` → rollback completo.
6. Marca o log como `awaiting_approval` (sucesso) ou `failed`.

## Evidência de saúde

```text
id_meta=4420455864866490  awaiting_approval  dup=d4fcbe1f...  eventos=2
id_meta=1303939155122936  awaiting_approval  dup=db683ff2...  eventos=4
id_meta=2252790068800057  awaiting_approval  dup=87a8c468...  eventos=3
id_meta=2074531043175582  awaiting_approval  dup=37b6787e...  eventos=2
```

Validações para um id_meta:

- Originais com `status_meta='PAUSED'`.
- Duplicado `<base>_v<N+1>` com `template_id_pri` não-nulo.
- Prospeccoes afetadas com `disparos_pausados=true` e
  `template_*_id` zerados.
- `campaign_jobs` ativos → `cancelled` com a mensagem correta.

## Callbacks Lambda → SagaOne

| Função SagaOne | Quando |
|---|---|
| `template-paused-webhook` | Lambda detecta `PAUSED` na Meta. |
| `reset-disparos-pendente` | Lambda solicita reset de pending para `(lead_id, prospeccao_id)`. |

Ambas idempotentes; payloads validados contra dados controlados antes do
rollout.

## Reabertura de disparos

Após template aprovado vinculado ao evento:

1. UI (`EventoBase` / `handleReplaceTemplate`) ou rotina automática
   `paused-template-resolution-logic` vincula novo template.
2. `prospeccoes.disparos_pausados` retorna a `false`.
3. `external-webhook-proxy → "acao":"alterado"` notifica a Lambda.
4. **"Retomar Falhas"** em `EventoBase` reprocessa o que estava
   pendente.

## Pontos críticos

- O **gate UI** (`EventoBase`/`DispararCustoModal`) impede disparo
  enquanto `disparos_pausados=true`.
- Gate server-side equivalente em `process-campaign-job` é monitorado
  via [`docs/recuperacao-jobs-orfaos.md`](./recuperacao-jobs-orfaos.md).
- Templates compartilhados entre empresas via `id_meta` exigem a
  duplicação per-empresa do passo 5 (ver memória
  `architecture/multi-tenant/whatsapp-template-sharing`).