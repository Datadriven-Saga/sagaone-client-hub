# Webhooks hard-coded — inventário e plano de migração

**Área:** Arquitetura / Webhooks
**Última revisão:** 2026-07-13
**Objetivo:** listar TODAS as URLs de webhook externas ainda hard-coded no código e o caminho de migração para o `webhook_registry` (tela `/administracao/webhooks`).

## Regra alvo

Nenhuma URL externa deve viver em código. Toda chamada deve:

```ts
const wh = await resolveWebhookBySlug(slug);
await fetch(wh.url, { method: wh.metodo, headers: { ...buildAuthHeaders(wh) }, body });
```

Slug = chave estável em `webhook_registry.slug`. Credencial resolvida via `buildAuthHeaders(row)` (secrets continuam no Supabase, nunca no banco).

---

## Inventário

Legenda de **Risco**: 🔴 crítico (quebra dispatch/importação/pós-vendas em prod), 🟠 alto (feature quebra mas não derruba operação), 🟢 baixo (afeta só admin/dev).

### 1. Edge functions — Paty / SagaOne (já allowlisted no proxy)

| Arquivo | Slug sugerido | Risco | Notas |
|---|---|---|---|
| `external-webhook-proxy/index.ts` | (roteador dinâmico) | 🟠 | Já migrado — usa `resolveWebhookByPathSuffix`. Fallback allowlist pode ser removido depois. |
| `maia-webhook-proxy/index.ts` (default URL) | `maia-generic-proxy` | 🟢 | URL default fixa `.../8275b29e-...`. Fácil de trocar por `resolveWebhookBySlug`. |

### 2. Edge functions — Lead lifecycle (SagaOne CRM)

| Arquivo | URL hard-coded | Slug sugerido | Risco |
|---|---|---|---|
| `create-lead/index.ts` | 3 URLs (`automatemaia`, `automatemaiawh`, `one`) | `lead-create-crm`, `lead-create-wh`, `lead-create-one` | 🔴 |
| `create-lead-ligacao` / `create-lead-pri` | idem | família `lead-create-*` | 🔴 |
| `search-lead/index.ts` | 3 URLs | `lead-search-*` | 🔴 |
| `update-crm-ids/index.ts` | `automatemaia/.../update-crm-ids` | `lead-update-crm-ids` | 🟠 |
| `resync-lead-ids/index.ts` | `automatemaiawh/.../resync-lead-ids` | `lead-resync-ids` | 🟠 |
| `opt-out-check/index.ts` | `automatemaia/.../opt-out-check` | `optout-check-crm` | 🔴 |
| `external-optout-register` + `_shared/external-optout.ts` | AWS `q009ac7jeg.execute-api.us-east-1.amazonaws...` | `optout-external-register` | 🔴 |

### 3. Edge functions — WhatsApp / Campanhas

| Arquivo | URL | Slug | Risco |
|---|---|---|---|
| `dispatch-leads-webhook/index.ts` L342-343 | n8n + Lambda `ccnv217nqk.execute-api...` | `wpp-dispatch-n8n`, `wpp-dispatch-lambda` | 🔴 |
| `process-campaign-job/index.ts` L244-245 | idem | idem | 🔴 |
| `process-import/index.ts` L1138 | `automatemaiawh/.../import-callback` | `import-callback-n8n` | 🔴 |
| `atendimento-status-webhook/index.ts` L9 | `automatemaiawh/.../recebe-status-sagaone` | `wpp-status-sagaone` | 🟠 |
| `send-crm-event-email/index.ts` L11 | `automatemaiawh/.../crm-event-email` | `email-crm-event` | 🟠 |
| `send-login-otp/index.ts` L56-58 | `one.sagadatadriven.com.br/...` | `auth-login-otp` | 🔴 (login) |

### 4. Edge functions — IA Ligação (Voz)

| Arquivo | URL | Slug | Risco |
|---|---|---|---|
| `ia-ligacao-webhook/index.ts` L9-13 | 5 URLs `automatemaiawh/...` | `voz-webhook-*` (5 slugs) | 🔴 |
| `create-base-ligacao/index.ts` L9-10 | 2 URLs | `voz-create-base-*` | 🔴 |
| `eventos-ligacao-proxy/index.ts` L44-88 | 7 endpoints n8n | `voz-eventos-*` | 🔴 |
| `sync-eventos-ligacao/index.ts` L10 | 1 URL | `voz-sync-eventos` | 🟠 |
| `sync-contatos-ligacao/index.ts` L10 | 1 URL | `voz-sync-contatos` | 🟠 |
| `sync-pri-dashboard/index.ts` L14 | 1 URL | `voz-sync-dashboard` | 🟠 |

### 5. Edge functions — Empresas / admin

| Arquivo | URL | Slug | Risco |
|---|---|---|---|
| `import-empresas/index.ts` L6 | `automatemaia/.../import-empresas` | `admin-import-empresas` | 🟠 |
| `manage-users/index.ts` L6-11 | 3 URLs (crm, maia, sagaone) | `admin-users-*` | 🔴 |
| `generate-avatar/index.ts` L5 | `automatemaia/.../avatar` | `admin-generate-avatar` | 🟢 |
| `trigger-webhook/index.ts` L86-87 | 2 URLs default | `admin-trigger-*` | 🟠 |
| `test-webhook/index.ts` L7 | 1 URL de teste | `dev-test-webhook` | 🟢 |
| `prospeccao-status/index.ts` L7-9 | 3 URLs | `prospeccao-status-*` | 🟠 |

### 6. Edge functions — 3rd party (NÃO vão para o registry)

APIs de terceiros com contratos próprios de auth — ficam como estão:

- `fetch-twilio-metrics`, `fetch-call-costs` → `api.twilio.com`
- `fetch-vapi-metrics`, `fetch-call-costs` → `api.vapi.ai`
- `cotacao-dolar` → `economia.awesomeapi.com.br`

### 7. Frontend (chamadas diretas do navegador — CSP bloqueia)

| Arquivo | URL | Ação |
|---|---|---|
| `src/components/pos-vendas/ConfiguracoesPosVendasTab.tsx` L59 | `automatemaiawh/...` | Já usa proxy — remover constante restante. 🟠 |
| `src/components/EnvioMensagemConfig.tsx` L53 | `automatemaiawh/...` | Roteirizar via `external-webhook-proxy`. 🔴 |
| `src/components/CadenciaLigacaoConfig.tsx` L427, L535 | `automatemaiawh/...` | Roteirizar via proxy. 🔴 |
| `src/components/resultados/AdminDashboardWhatsApp.tsx` L296 | `automatemaiawh/...` | Roteirizar via proxy. 🟠 |
| `src/components/resultados/AdminDashboardLigacao.tsx` L65-66 | 2 URLs | Roteirizar via proxy. 🟠 |
| `src/pages/pos-vendas/TemplatesPaty.tsx` L149 | `https://saga.com.br` | Placeholder estático. 🟢 |
| `src/lib/conviteUtils.ts` L5 | `https://one.sagadatadriven.com.br` | Base URL de convite — mover para env/registry como `public-invite-base`. 🟢 |

---

## Solução padrão por categoria

### A) Edge function que chama URL fixa

```ts
import { resolveWebhookBySlug, buildAuthHeaders, markWebhookUsed }
  from "../_shared/webhook-registry.ts";

const wh = await resolveWebhookBySlug("wpp-dispatch-n8n");
const res = await fetch(wh.url, {
  method: wh.metodo,
  headers: { "Content-Type": "application/json", ...buildAuthHeaders(wh) },
  body: JSON.stringify(payload),
});
await markWebhookUsed(wh.id);
```

### B) Frontend que hoje chama URL externa direto

1. Adicionar linha em `webhook_registry` (slug único).
2. Trocar `fetch(URL, ...)` por `supabase.functions.invoke("external-webhook-proxy", { body: { endpoint: "<slug-ou-suffix>", ...payload } })`.
3. Remover a constante do componente.

### C) URL base pública (convites, e-mails)

Mover para `webhook_registry` (categoria `public-url`, sem credencial) ou env var do Vite quando for base do próprio app.

---

## Riscos consolidados

| Risco | Cenário | Mitigação |
|---|---|---|
| 🔴 URL registrada errada quebra dispatch/CRM em produção | Master edita slug crítico e salva URL inválida | Audit em `webhook_registry_audit`, `ativo=false` como kill-switch, teste em preview antes de propagar |
| 🔴 Migração em massa pode derrubar prod | Refactor de `dispatch-leads-webhook` etc. sem validação | Migrar em lotes pequenos, fallback: `resolveWebhookBySlug(slug) ?? URL_ANTIGA` na primeira versão, remover só depois de 1 semana estável |
| 🟠 Slug ausente após deploy | Seed não incluiu a URL nova | `resolveWebhookBySlug` deve lançar erro claro; edge function retorna 503 (não 500 genérico) |
| 🟠 Credencial removida em Supabase Secrets | Header vazio → 401 da n8n | Tela `/administracao/webhooks` mostra badge vermelho via `check-webhook-credential` |
| 🟢 Deriva entre banco e código | Slug renomeado no banco sem update no código | PR checklist: rodar `rg "resolveWebhookBySlug\("` antes de aprovar mudanças no seed |

---

## Ordem sugerida de migração

1. **Grupo 7** (frontend direto → proxy) — já quebra CSP hoje, ganho imediato.
2. **Grupo 5** (admin) — baixo tráfego, bom para validar padrão.
3. **Grupo 4** (voz) — isolado do dispatch WPP.
4. **Grupo 3** (WPP/campanhas) — core, exige janela + fallback.
5. **Grupo 2** (lead lifecycle) — mais crítico, migrar por último com feature flag.

## Relacionado

- [Webhooks e integrações](./webhooks-e-integracoes.md)
- Memória: `external-api-proxy-and-csp-compliance`
