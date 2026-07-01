# Auditoria de Prospecção

**Área:** Prospecção
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## O que é

Duas tabelas de auditoria cobrem prospecção:

1. **`logs_prospeccoes`** — mudanças estruturais no **evento** (`prospeccoes`): criação, edição de template, alteração de flags, mudança de datas, importação de base, disparos manuais.
2. **`logs_movimentacao_contatos`** — mudanças de **status do lead** no Kanban (é também a fonte do webhook Mobi).

## `logs_prospeccoes`

Populada por:
- Trigger `trg_audit_prospeccoes` (SECURITY DEFINER) em `prospeccoes` — grava diff dos campos sensíveis com autor (`auth.uid()`).
  Quando invocada por `service_role`, também tenta capturar IP / User-Agent (se disponíveis no request).
- Edge Functions que fazem operações não-triviais (ex.: `create-lead-pri` grava `acao='lead_criado_pri'` ou `'lead_vinculado_pri'`).
- Import (`origem='pool'` ou `origem='planilha'`) grava `acao='importacao_pool'` / `'importacao_planilha'` com contadores.

Ações canônicas (`acao`):

| Ação | Origem | Detalhes |
|------|--------|----------|
| `prospeccao_criada` | trigger | Nova linha em `prospeccoes` |
| `prospeccao_editada` | trigger | Diff de campos sensíveis |
| `disparo_iniciado` | edge / FE | Job criado |
| `disparo_falhou` | edge | Job cancelado/erro |
| `disparo_retomado` | edge | Recovery de órfão |
| `importacao_pool` | edge | `importar_pool_para_evento` |
| `importacao_planilha` | edge | `process-import` |
| `lead_criado_pri` | `create-lead-pri` | Novo contato via API Pri |
| `lead_vinculado_pri` | `create-lead-pri` | Contato já existia, só vinculou |

Memory canônica: `security/audit/prospeccoes-trigger`.

## `logs_movimentacao_contatos`

Populada por:
- Toda mudança de `contatos.status` (via UI, RPC atômica ou integração).
- Check-in (recepção): manual + registro em `recepcao_visitas`.
- `create-lead-pri`: escreve mesmo sem mudança de status para popular timeline (com `usuario_id = PRI_IA_USER_ID` — filtrado pelo dispatcher Mobi para não vazar automação).

Trigger `trg_dispatch_movimentacao_lead_webhook` (fonte única) chama `trigger-webhook` via `pg_net`, respeitando:
- Flag `webhook_movimentacao_lead` (per_empresa).
- Canal do evento em `{Mensal, Grande Evento}`.
- `usuario_id != PRI_IA_USER_ID`.

Memory canônica: `architecture/webhooks/movimentacao-lead-single-source`.

## `contato_timeline` (view agregada)

Combina `logs_movimentacao_contatos` + `contato_anotacoes` + chamadas + webhooks numa única sequência cronológica para exibição no lead. É **derivada**, não persistente.

## Regras de negócio

- Trigger de auditoria de `prospeccoes` **não** deve gerar loop com o próprio update (usa `pg_trigger_depth() = 1`).
- Ações via Pri IA são identificáveis por `usuario_id = PRI_IA_USER_ID` — filtros dashboards excluem para não distorcer performance humana.
- `logs_prospeccoes.acao` é convenção de string — adicionar nova ação exige atualizar filtros da tela de auditoria (`/administracao/visao-geral` *(pendente)*).

## Relacionado

- [Kanban e status](./kanban-e-status.md)
- [Logs de disparos](./logs-disparos.md)
- [Notificações](../arquitetura/notificacoes.md)