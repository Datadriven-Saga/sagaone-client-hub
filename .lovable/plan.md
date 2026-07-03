# Plano: Documentar Sincronização SagaOne ↔ MobiGestor

## Objetivo

Criar um doc canônico end-to-end da sincronização com o MobiGestor (fluxo interno de qualificação antes do CRM), preencher a lacuna `(pendente)` em `docs/apis/webhooks-recebidos.md` e cruzar links a partir dos docs existentes (feature-flags, kanban, recepção, auditoria).

## Entregáveis

### 1. Novo doc — `docs/arquitetura/sincronizacao-mobigestor.md`

Estrutura:

- **O que é** — não é chamada direta ao CRM MobiGestor; é um fluxo n8n interno (`recebe-status-sagaone`) que orquestra qualificação/desqualificação de leads na central antes de propagar pro MobiGestor.
- **Endpoint de saída**
  - URL: `https://automatemaiawh.sagadatadriven.com.br/webhook/recebe-status-sagaone` (env `WEBHOOK_MOVIMENTACAO_LEAD_URL`)
  - Auth: header `saga_one_supabase: <SAGA_ONE>`
  - Método: `POST`, `Content-Type: application/json`
- **Origem canônica do disparo** — trigger PG `trg_dispatch_movimentacao_lead_webhook` em `logs_movimentacao_contatos` → `pg_net` → edge `trigger-webhook` → helper `dispararMovimentacaoLeadKanban`. Fonte única (FE/edges **não** chamam direto).
- **Gates de disparo** (na ordem em que rodam no helper):
  1. Campos obrigatórios: `contato_id`, `empresa_id`, `prospeccao_id`, `status_novo`.
  2. Skip se `usuario_id = PRI_IA_USER_ID`.
  3. Feature flag `webhook_movimentacao_lead` per_empresa ligada.
  4. Canal da prospecção ∈ {`Mensal`, `Grande Evento`}.
  5. `status_novo` ∈ {`Confirmado`, `Check-in`, `Descartado`}.
- **Payload enviado** — tabela com campos:
  `nome`, `telefone`, `dealer_id` (= `empresas.crm_id`), `nome_evento`, `status_anterior`, `status_novo`, `contato_id`, `lead_id`, `empresa_id`, `prospeccao_id`, `codigo_proposta`, `email_vendedor`, `vendedor_atendimento_nome`, `vendedor_atendimento_email` (opcionais quando recepção preencheu).
- **Lógica interna do fluxo n8n** (explicada pelo usuário):
  - `Confirmado` / `Check-in`: tenta criar o lead na loja; antes valida se já existe lead na central com aquele telefone.
    - Se **existe**: qualifica o lead da central com tags/anotações indicando status SagaOne + evento.
    - Se **não existe**: cria o lead.
  - `Descartado`: cria e desqualifica o lead na central.
  - Lead já existente vindo do SagaOne pode ser atualizado como check-in ou desqualificado conforme o `status_novo`.
- **Resposta esperada**
  - Sucesso na criação: JSON com `proposalId` (ou `codigo_proposta` / `proposal_id`) — capturado e persistido em `contatos.codigo_proposta`.
  - Sucesso em atualização: `success: true` (sem proposalId).
  - Fallback de parsing: aceita `data.proposalId`/`data.codigo_proposta` aninhados.
- **Loop reverso (entrada)** — `atendimento-status-webhook` recebe do MobiGestor mudanças de status, valida `dealer_id ↔ crm_id`, escreve em `logs_movimentacao_contatos` com `usuario_id = PRI_IA_USER_ID` (gate #2 evita eco infinito).
- **Idempotência & retry** — `pg_net` sem retry automático; duplicações históricas foram causadas por FE + trigger chamando em paralelo (resolvido: FE removido). Falha do endpoint fica logada nos logs da edge; retry manual via reprocesso do log.
- **Diagrama** (```text ASCII):

```text
[Kanban / Recepção / Check-in / confirm-presence]
        │
        ▼
INSERT logs_movimentacao_contatos
        │  (trigger trg_dispatch_movimentacao_lead_webhook)
        ▼
   pg_net POST → edge trigger-webhook
        │
        ▼
dispararMovimentacaoLeadKanban  (aplica os 5 gates)
        │
        ▼  header saga_one_supabase
n8n /webhook/recebe-status-sagaone
        │
        ├── existe na central? → qualifica (tags/anotações)
        ├── não existe?        → cria lead
        └── Descartado?        → cria e desqualifica
        │
        ▼ resposta { proposalId } | { success }
UPDATE contatos.codigo_proposta ← proposalId
        │
        ▼ (fluxo reverso, assíncrono)
MobiGestor → atendimento-status-webhook → logs_movimentacao_contatos
        (com usuario_id = PRI_IA_USER_ID, evita loop)
```

- **Runbook / erros comuns** — tabela:
  - `webhook_url_missing` → conferir env `WEBHOOK_MOVIMENTACAO_LEAD_URL`.
  - `flag_disabled` → habilitar `webhook_movimentacao_lead` para a empresa.
  - `canal_nao_elegivel` → canal ≠ Mensal/Grande Evento, comportamento esperado.
  - `status_nao_elegivel` → status ≠ Confirmado/Check-in/Descartado, comportamento esperado.
  - 403 no destino → `SAGA_ONE` ausente/errado ou header com nome errado (histórico: `Authorization: Bearer` — errado, correto é `saga_one_supabase`).
  - Duplicação → confirmar que nenhum FE/edge chama `trigger-webhook` para `movimentacao_lead_kanban` (só o trigger PG deve chamar).
- **Segredos & envs** — `WEBHOOK_MOVIMENTACAO_LEAD_URL`, `SAGA_ONE`, `PRI_IA_USER_ID`.
- **Relacionado** — links pros docs listados abaixo.

### 2. Atualizações em docs existentes

- `docs/apis/webhooks-recebidos.md` — remover `(pendente)` na linha "APIs recebidas" da seção do fluxo de saída e apontar para o novo doc; enriquecer a seção `atendimento-status-webhook` com o gate anti-loop (`usuario_id = PRI_IA_USER_ID`).
- `docs/arquitetura/webhooks-e-integracoes.md` — trocar link `APIs recebidas (pendente)` por `sincronizacao-mobigestor.md`; adicionar URL do endpoint na linha do trigger PG.
- `docs/administracao/feature-flags.md` — linhas 29-30: adicionar link "Ver [Sincronização MobiGestor](../arquitetura/sincronizacao-mobigestor.md) para o contrato do webhook".
- `docs/prospeccao/kanban-e-status.md` — no bloco "Webhook Mobi" (linha ~43) apontar pro novo doc.
- `docs/prospeccao/auditoria.md` — na seção `logs_movimentacao_contatos` apontar pro novo doc.
- `docs/recepcao/fluxo-checkin.md` e `docs/recepcao/vendedor-atendimento.md` — link cruzado no bloco de webhook.
- `docs/README.md` — adicionar entrada na seção Arquitetura.

## Fora de escopo

- Alterações de código (edge/trigger).
- Alterações no fluxo n8n do MobiGestor.
- Documentar o webhook reverso `atendimento-status-webhook` em profundidade (fica com o esboço atual + gate anti-loop).

## Confirmação

Se ok, sigo em modo build criando o `sincronizacao-mobigestor.md` e aplicando os cross-links.
