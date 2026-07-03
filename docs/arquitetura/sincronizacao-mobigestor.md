# Sincronização SagaOne ↔ MobiGestor

**Área:** Arquitetura
**Público-alvo:** dev
**Última revisão:** 2026-07-03

## O que é

Toda mudança de status relevante de um lead (Confirmado, Check-in, Descartado) sai do SagaOne para um **fluxo intermediário no n8n** (`recebe-status-sagaone`) que orquestra a qualificação/desqualificação do lead na **central de leads** e, quando cabível, cria o lead na loja do MobiGestor. **Não é uma chamada direta ao CRM**: o n8n é quem decide criar, qualificar, atualizar ou desqualificar.

Não há canal síncrono MobiGestor → SagaOne. A **Pri IA (bot de disparo WhatsApp)** movimenta os leads **em paralelo nos dois sistemas** (SagaOne e Mobi) por conta própria. Quando ela escreve aqui, o log sai com `usuario_id = PRI_IA_USER_ID` e o **gate #2 skipa** o envio ao Mobi — evita duplicar o que a IA já fez lá.

## Endpoint de saída

| Campo | Valor |
|---|---|
| URL | `https://automatemaiawh.sagadatadriven.com.br/webhook/recebe-status-sagaone` |
| Env | `WEBHOOK_MOVIMENTACAO_LEAD_URL` |
| Método | `POST` |
| Content-Type | `application/json` |
| Auth | header `saga_one_supabase: <SAGA_ONE>` |

> Bug histórico: usar `Authorization: Bearer …` — errado. O n8n valida **somente** o header `saga_one_supabase`.

## Origem canônica do disparo

```text
INSERT logs_movimentacao_contatos
   │  (trigger PG trg_dispatch_movimentacao_lead_webhook)
   ▼
pg_net POST → edge trigger-webhook
   │
   ▼
_shared/movimentacao-lead-webhook.ts :: dispararMovimentacaoLeadKanban
   │
   ▼  header saga_one_supabase
n8n /webhook/recebe-status-sagaone
```

**Fonte única.** FE e outras edges **não** invocam `trigger-webhook` para `movimentacao_lead_kanban` — só o trigger PG dispara. Duplicações históricas foram causadas por FE chamando em paralelo (resolvido).

## Gates de disparo (ordem no helper)

1. Campos obrigatórios presentes: `contato_id`, `empresa_id`, `prospeccao_id`, `status_novo`.
2. **Skip Pri IA** — `usuario_id == PRI_IA_USER_ID` → não dispara. A Pri IA (bot WPP) já atualiza o Mobi em paralelo quando movimenta o lead no SagaOne; reenviar aqui duplicaria a chamada.
3. **Feature flag** `webhook_movimentacao_lead` **per_empresa** ligada.
4. **Canal da prospecção** ∈ {`Mensal`, `Grande Evento`}.
5. **`status_novo`** ∈ {`Confirmado`, `Check-in`, `Descartado`}.

Qualquer gate rejeitado retorna `{ success: true, skipped: true, reason }` — não é erro, é comportamento esperado.

## Payload enviado

```json
{
  "nome": "Fulano",
  "telefone": "62999999999",
  "dealer_id": "<empresas.crm_id>",
  "nome_evento": "<prospeccoes.titulo>",
  "status_anterior": "Convidado",
  "status_novo": "Check-in",
  "contato_id": "<uuid>",
  "lead_id": 12345,
  "empresa_id": "<uuid>",
  "prospeccao_id": "<uuid>",
  "codigo_proposta": null,
  "email_vendedor": "vendedor@gruposaga.com.br",
  "vendedor_atendimento_nome": "Romilson",
  "vendedor_atendimento_email": "romilson@gruposaga.com.br"
}
```

| Campo | Origem | Notas |
|---|---|---|
| `nome`, `telefone`, `codigo_proposta` | `contatos` | telefone normalizado (DB) |
| `dealer_id` | `empresas.crm_id` | usado pelo n8n para localizar a loja |
| `nome_evento` | `prospeccoes.titulo` | |
| `status_anterior`, `status_novo` | `logs_movimentacao_contatos` | |
| `email_vendedor` | `auth.users.email` do `usuario_id`; fallback `contatos.responsavel_email` (confirm-presence público) | representa **quem operou** o sistema |
| `vendedor_atendimento_*` | recepção (check-in) | opcionais — só viajam quando preenchidos; representam **quem vai atender** |
| `lead_id` | `logs_movimentacao_contatos.lead_id` | integer da central |

## Lógica interna do fluxo n8n

O SagaOne apenas dispara; o n8n é quem decide:

- **`Confirmado` / `Check-in`** → tenta criar o lead na loja do MobiGestor. Antes valida na central se já existe lead com aquele telefone:
  - **Existe** → qualifica o lead da central com tags/anotações indicando status SagaOne + evento.
  - **Não existe** → cria o lead.
- **`Descartado`** → cria (se necessário) e desqualifica o lead na central.
- Lead já existente vindo do SagaOne pode ser atualizado como **check-in** ou **desqualificado** na Mobi conforme o `status_novo` recebido.

## Resposta esperada

| Cenário | Corpo típico | Ação do SagaOne |
|---|---|---|
| Criação bem-sucedida | `{ "proposalId": "12345" }` (ou `codigo_proposta` / `proposal_id`; aceita aninhado em `data.*`) | `UPDATE contatos.codigo_proposta` com o valor retornado |
| Atualização / qualificação | `{ "success": true }` (sem `proposalId`) | Nada — mantém o `codigo_proposta` existente |
| Erro HTTP | qualquer 4xx/5xx | Log no edge; sem retry automático |

O helper faz `JSON.parse` tolerante; se a resposta não for JSON válido, apenas ignora a captura de `codigo_proposta`.

## Movimentações da Pri IA em paralelo

A Pri IA (bot de disparo WhatsApp) conversa com o lead e reage aos eventos da conversa movimentando o Kanban dos **dois** sistemas simultaneamente:

- Cliente respondeu → move para *Atribuído* (no SagaOne **e** no Mobi).
- Cliente agendou → move para *Convidado* (no SagaOne **e** no Mobi).
- E assim por diante.

Como o bot já cuida do Mobi diretamente, o SagaOne **não** deve reenviar essa mesma movimentação — faria chamada duplicada. Por isso o log da IA sai com `usuario_id = PRI_IA_USER_ID` e o **gate #2** do trigger PG bloqueia o dispatch.

> `atendimento-status-webhook` **não é** parte deste fluxo. É uma edge de saída (não recebida), usada em outro contexto — está descrita em [`../apis/webhooks-recebidos.md`](../apis/webhooks-recebidos.md).

## Idempotência & retry

- `pg_net` **não** faz retry automático — cada `INSERT` em `logs_movimentacao_contatos` dispara **uma única** chamada HTTP.
- Falha no destino fica registrada nos logs da edge `trigger-webhook`. Retry manual é feito reprocesando o log (rerun no n8n) ou reinserindo o log de movimentação.
- Duplicação (mesmo `contato_id + status_novo` chegando 2x em segundos) sempre indicou FE + trigger disparando em paralelo — hoje FE removido, se voltar a acontecer procurar chamadas diretas a `trigger-webhook` com `gatilho = movimentacao_lead_kanban`.

## Diagrama end-to-end

```text
[Kanban]  [Recepção FAB]  [QR check-in]  [confirm-presence público]
     \        |               |                 /
      \       |               |                /
       ▼      ▼               ▼               ▼
          INSERT logs_movimentacao_contatos
                        │
          trigger trg_dispatch_movimentacao_lead_webhook
                        │
                        ▼
                pg_net POST (interno)
                        │
                        ▼
              edge trigger-webhook
                        │
          dispararMovimentacaoLeadKanban
          (5 gates: campos / pri_ia / flag / canal / status)
                        │
                        ▼  header saga_one_supabase
          n8n /webhook/recebe-status-sagaone
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
   já existe?     não existe?     Descartado?
   qualifica      cria lead       cria + desqualifica
          │             │              │
          └─────────────┼──────────────┘
                        ▼
          { proposalId } | { success: true }
                        │
                        ▼
          UPDATE contatos.codigo_proposta (quando veio proposalId)

... (em paralelo, quando a IA movimenta) ...

Pri IA (bot WPP)
     ├── SagaOne: INSERT log (usuario_id = PRI_IA_USER_ID) → gate #2 skipa
     └── Mobi:    atualiza direto (mesma ação, sem passar pelo SagaOne)
```

## Runbook / erros comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| Nenhum lead sincronizado numa empresa | Flag `webhook_movimentacao_lead` desligada | Ligar per_empresa em `/administracao/feature-flags` |
| Sync some para eventos específicos | Canal ≠ Mensal/Grande Evento | Comportamento esperado — canal filtrado |
| Status muda mas não sincroniza | `status_novo` ∉ {Confirmado, Check-in, Descartado} | Comportamento esperado — só esses 3 status disparam |
| `webhook_url_missing` no log | Env não configurada | Setar `WEBHOOK_MOVIMENTACAO_LEAD_URL` na edge |
| 403 no destino | `SAGA_ONE` errado ou header com nome errado | Confirmar segredo + header `saga_one_supabase` (não `Authorization`) |
| Webhook Mobi disparado 2x | FE + trigger em paralelo | Grepar por `trigger-webhook` + `movimentacao_lead_kanban` no FE/edges — só o trigger PG deve chamar |
| `codigo_proposta` não persistiu | Resposta não-JSON ou sem `proposalId` | Conferir log do n8n; atualização legítima não retorna proposalId |
| Duplicação em movimentação feita pela Pri IA | Log gravado sem `usuario_id = PRI_IA_USER_ID` | Confirmar que a integração da IA está setando o usuário Pri IA no `logs_movimentacao_contatos` — gate #2 depende disso |

## Segredos & envs

- `WEBHOOK_MOVIMENTACAO_LEAD_URL` — URL do fluxo n8n.
- `SAGA_ONE` — token de saída (header `saga_one_supabase`).
- `PRI_IA_USER_ID` — UUID do usuário técnico Pri IA (gate anti-duplicação para movimentações do bot WPP).

## Código & tabelas

- Helper: [`supabase/functions/_shared/movimentacao-lead-webhook.ts`](../../supabase/functions/_shared/movimentacao-lead-webhook.ts)
- Edge: [`supabase/functions/trigger-webhook/index.ts`](../../supabase/functions/trigger-webhook/index.ts)
- Trigger PG: `trg_dispatch_movimentacao_lead_webhook` em `logs_movimentacao_contatos`
- Tabelas: `logs_movimentacao_contatos`, `contatos` (`codigo_proposta`), `prospeccoes` (`canal`, `titulo`), `empresas` (`crm_id`)
- Flag: `webhook_movimentacao_lead` (per_empresa) em `system_feature_flags`

## Relacionado

- [Webhooks e integrações](./webhooks-e-integracoes.md)
- [Webhooks recebidos](../apis/webhooks-recebidos.md)
- [Kanban e status](../prospeccao/kanban-e-status.md)
- [Auditoria de prospecção](../prospeccao/auditoria.md)
- [Fluxo de check-in](../recepcao/fluxo-checkin.md)
- [Vendedor de atendimento](../recepcao/vendedor-atendimento.md)
- [Feature Flags](../administracao/feature-flags.md)
