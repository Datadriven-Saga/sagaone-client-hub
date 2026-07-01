# Pós-Vendas — Visão geral

**Área:** Pós-Vendas
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Módulo `/pos-vendas` — configura a **Paty** (agente WhatsApp de pós-venda) para disparar templates automaticamente em resposta a gatilhos externos (SagaOne / MySaga / DataLake). Diferente da Prospecção (que vive dentro do próprio SagaOne), a Paty **é executada por uma stack externa** (n8n + banco Paty). O SagaOne apenas configura mapeamento e persiste em cache local.

## Sub-áreas

| Sub-área | Rota | Descrição |
|----------|------|-----------|
| **Peças** | `/pos-vendas/pecas` | Gatilhos disparados pelo sistema de peças (agendamento, entrega, retirada). Ver [pecas](./pecas.md). |
| **Entregas** | `/pos-vendas/entregas` | Gatilhos de entrega de veículo novo — suporta **múltiplos templates sequenciais** por gatilho. Ver [entregas](./entregas.md). |
| **Agendamentos** | `/pos-vendas/agendamentos` | Visão consolidada de agendamentos gerados/tocados pela Paty. Ver [agendamentos](./agendamentos.md). |
| **Cadência** | `/pos-vendas/paty/cadencia` | Cadência conversacional (sequência de mensagens de continuidade). Ver [cadencia](./cadencia.md). |
| **Templates Paty** | `/pos-vendas/paty/templates` | Editor de templates + vocabulário de variáveis NAMED. Ver [paty-templates](./paty-templates.md). |

## Fluxo funcional (para usuário)

1. **Selecionar agente Paty** (`AgenteSelector`) — cada agente é um número WhatsApp cadastrado em `agentes_ia` e vinculado à empresa via `agente_empresas`.
2. **Configurar loja / gatilho:** para cada slug de gatilho, escolher qual template Paty (já aprovado na Meta) será disparado.
3. **Ativar/desativar** o toggle — reflete imediatamente no backend externo via webhook de upsert.
4. **Acompanhar** entregas/agendamentos gerados na aba correspondente.

## Arquitetura de integração

```text
UI Pós-Vendas
   │  (supabase.functions.invoke)
   ▼
external-webhook-proxy (Edge Function)
   │  endpoint = "upsert-paty-*-template" | "upsert-paty-cadencia-*"
   ▼
n8n / stack Paty (fora do SagaOne)
   │
   ▼
banco Paty (mysql externo) + WhatsApp Business API
```

Todo tráfego **saída** obrigatoriamente passa pelo `external-webhook-proxy` — CSP do SagaOne bloqueia chamada direta ao n8n. Ver memory `architecture/external-api-proxy-and-csp-compliance`.

## Papéis operacionais

- **Master / Admin / TI** — configura agentes, associa gatilhos/lojas, edita templates Paty.
- **Gerente de Pós-Venda** — permissão `canAccessPosVendas*` — configura templates da loja, não mexe em agente.
- **Consumidor externo** — Peças / MySaga / DataLake — dispara os gatilhos que a Paty escuta (não usa a UI SagaOne).

## Vocabulário

- **Slug / Gatilho:** string canônica (ex.: `novo-lead-criacao`, `entrega-confirmada`). Fixa no frontend. Não confundir com nome do template.
- **Sequência:** posição na cadeia de templates de um mesmo slug (apenas Entregas — Peças é 1:1).
- **Template PRI:** ID inteiro do template no banco Paty (`template_id` em `paty_*_template`).
- **Template Meta:** ID string do template aprovado na Meta (usado por `id_meta` e sharing multi-tenant).

## Regras de negócio transversais

- Template **pausado** (webhook Meta) invalida qualquer configuração ativa que aponte para ele — ver memories `features/whatsapp/paused-template-*`.
- Toggle é **sempre** replicado no backend externo — desligar no UI **precisa** chamar `upsert-paty-*-template` com `ativo=false` (não é lazy).
- Templates Paty são **NAMED** (variáveis `{{nome_cliente}}`), diferente dos POSITIONAL usados na Prospecção.

## Documentos desta área

- [Peças](./pecas.md)
- [Entregas](./entregas.md)
- [Cadência](./cadencia.md)
- [Agendamentos](./agendamentos.md)
- [Paty Templates](./paty-templates.md)

## Relacionado

- [Webhooks e integrações](../arquitetura/webhooks-e-integracoes.md) *(pendente)*
- [Notificações](../arquitetura/notificacoes.md)
- [Template pausado](../prospeccao/template-pausado.md)