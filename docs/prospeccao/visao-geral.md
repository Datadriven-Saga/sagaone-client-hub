# Prospecção — Visão geral

**Área:** Prospecção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Prospecção é o núcleo operacional do SagaOne: onde uma **loja** cria um **evento** (mensal, grande evento ou ligação), importa leads, dispara mensagens (WhatsApp / Ligação IA) e acompanha o funil até o check-in / venda.

Um "evento" na fala do usuário = uma linha em `prospeccoes` (canal, datas, template, cadência, marca). Os **leads participantes** são os vínculos em `eventos_prospeccao` (par `contato_id × prospeccao_id`) — ver [glossário](../glossario.md).

## Fluxo funcional (para usuário)

1. **Criar evento** em `/prospeccao` → escolher canal, marca, data início/fim, template WPP e cadência.
2. **Importar leads** via [planilha](../entra-dados/importacao-planilha.md) ou [pool](../entra-dados/importacao-pool.md).
3. **Disparar** WhatsApp em massa (imediato ou agendado) — ver [dispatch-whatsapp](./dispatch-whatsapp.md).
4. **Atender** no Kanban conforme leads respondem — ver [kanban-e-status](./kanban-e-status.md).
5. **Registrar check-in** na chegada do lead — ver [recepção](../recepcao/fluxo-checkin.md).
6. **Acompanhar resultados** em [`/resultados`](../resultados-e-relatorios/dashboards.md).

## Estrutura de dados (alto nível)

```text
empresas ──┬─< prospeccoes ──< eventos_prospeccao >── contatos
           │                        │
           │                        └─< logs_movimentacao_contatos (timeline)
           │
           ├─< contato_quarentena  (bloqueio por telefone/marca/canal)
           ├─< campaign_jobs       (disparos)
           │       └─< campaign_batches   (lotes)
           │
           └─< logs_disparos       (auditoria custo/execução)
```

Nomes iguais, coisas diferentes:

| Nome | Tabela | Papel |
|------|--------|-------|
| Prospecção / Evento | `prospeccoes` | Definição do evento (template, canal, datas). |
| Evento de Prospecção | `eventos_prospeccao` | Vínculo lead↔evento **e** histórico (débito arquitetural conhecido). |
| Cadências extras | `prospeccao_cadencias` | Ordens 2 e 3 da cadência de disparo IA WhatsApp (a #1 continua nas colunas legacy de `prospeccoes`). |

### Cadências (IA WhatsApp)

- Cadência **#1** permanece nas colunas legacy de `prospeccoes` (template principal, template agendado/não agendado, `data_envio_cadencia`) — não quebrar consumidores existentes.
- Cadências **#2 e #3** vivem em `prospeccao_cadencias` (`ordem` 1..3, FK para `prospeccoes`).
- No payload do webhook de criação/edição de evento vai um novo campo `cadencias: []` agregando todas — a estrutura legacy também é enviada por compatibilidade.
- **RLS**: `prospeccao_cadencias` não tem `empresa_id` próprio; policies validam via join com `prospeccoes` usando `user_can_access_empresa(p.empresa_id, auth.uid())` — ordem dos args crítica (ver [Multi-tenant](../arquitetura/multi-tenant.md#-ordem-dos-argumentos)).

## Canais

- **Mensal** / **Grande Evento** — canais que aceitam WhatsApp em massa e alimentam Kanban/webhook Mobi.
- **Ligação** — canal IA de voz (Vapi/Twilio). Ver [ia-ligacao](./ia-ligacao.md).

## Papéis operacionais

- **SDR** — trabalha leads Atribuídos → Contatado → Em Espera / Convidado. Lock de 30 leads simultâneos, ver [atribuicao-sdr](./atribuicao-sdr.md).
- **Vendedor** — recebe leads Em Espera / Convidado, faz check-in / venda.
- **Gestor** — visualiza tudo da empresa, redistribui, aprova.
- **Recepcionista** — check-in via FAB / QR (ver [recepção](../recepcao/fluxo-checkin.md)).
- **Admin / TI** — cria eventos, importa base, configura cadência.

## Documentos desta área

- [Kanban e status](./kanban-e-status.md)
- [Atribuição SDR / Vendedor](./atribuicao-sdr.md)
- [Quarentena](./quarentena.md)
- [Disparo WhatsApp](./dispatch-whatsapp.md)
- [Template pausado](./template-pausado.md)
- [Recuperação de jobs órfãos](./recuperacao-jobs-orfaos.md)
- [Correção do dispatcher programado](./correcao-dispatcher.md)
- [IA de Ligação](./ia-ligacao.md)
- [Logs de disparos](./logs-disparos.md)
- [Auditoria](./auditoria.md)

## Relacionado

- [Multi-tenant](../arquitetura/multi-tenant.md) *(pendente)*
- [Permissões e RBAC](../arquitetura/permissoes-e-rbac.md) *(pendente)*
- [Notificações](../arquitetura/notificacoes.md)