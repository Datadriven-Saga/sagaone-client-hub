# IA de Ligação (Voz)

**Área:** Prospecção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Canal de disparo por **voz** (chamada telefônica) conduzido por agente IA. Backend é externo (**Vapi** e/ou **Twilio**), integrado via Edge Functions e webhooks. Métricas e custo consolidados em dashboard próprio.

## Fluxo funcional (para usuário)

1. **Criar evento** com canal = `Ligação`.
2. **Escolher agente** IA em `agentes_ia` (associado à empresa via `agente_empresas`).
3. **Importar base** normalmente (planilha / pool).
4. **Iniciar disparo** — leads são enfileirados na API externa.
5. **Acompanhar** em `/resultados` (dashboard de ligação) e no Kanban (leads contatados ≥1 tentativa).
6. **Timeline** unificada mostra cada tentativa, transcrição resumida e custo por chamada.

## Detalhes técnicos

- **Tabelas locais:** `agentes_ia`, `agente_empresas`, `agente_cadencias`, `agente_cadencias_steps`, `agente_variaveis`, `agente_performance`, `agente_integracoes`, `agente_followups`, `cadencia_pri_voz`, `eventos_pri_voz`, `prospect_pri_voz`, `vapi_calls_cache`.
- **Edge Functions:**
  - `create-base-ligacao`, `create-lead-ligacao`, `get-base-ligacao`
  - `sync-contatos-ligacao`, `sync-eventos-ligacao`, `sync-pri-dashboard`
  - `eventos-ligacao-proxy`, `ia-ligacao-webhook`
  - `fetch-vapi-metrics`, `fetch-twilio-metrics`, `fetch-call-costs`
- **Hooks:** `usePriLigacaoEventos`, `useMetricasLigacao`.
- **Identificação do agente:** memory `auth/agent-identification-rules` — validado por `agente_empresas` + telefone ≥ 10 dígitos.
- **Sync de custos:** memory `architecture/performance/cost-management-sync-logic` — Vapi/Twilio + cache `vapi_calls_cache`.
- **Backup externo:** memory `architecture/external-pri-backup-tables` — `*_pri_voz` são mirror via webhook upsert.
- **Isolamento:** memory `security/rls/pri-voz-multi-tenant-access` — RLS libera empresas ativas de `user_empresas`.

## Regras de negócio

- Um lead é considerado **contatado** com ≥1 tentativa (mesmo sem atendimento).
- Custo por chamada vem do provedor (Vapi = por minuto; Twilio = por segundo). SagaOne **não** define custo por lead — para WhatsApp existe custo unitário fixo em USD (ver [logs-disparos](./logs-disparos.md)).
- Dashboards administrativos agregam cross-empresa (ver memory `admin-aggregated-dashboards`).

## Erros comuns

| Sintoma | Causa | Ação |
|---------|-------|------|
| Métricas de custo desatualizadas | Cache `vapi_calls_cache` frio | Aguardar próximo sync ou disparar manualmente `fetch-vapi-metrics`. |
| Agente não dispara | Falta vínculo `agente_empresas` ou telefone inválido | Conferir memory `agent-identification-rules`. |
| Lead aparece sem tentativa mas foi discado | Delay do webhook `ia-ligacao-webhook` | Aguardar; se persistir, checar logs da Edge Function. |

## Relacionado

- [Logs de disparos](./logs-disparos.md)
- [Dashboards](../resultados-e-relatorios/dashboards.md) *(pendente)*
- [Cadência Voz](../pos-vendas/cadencia.md) *(pendente)*