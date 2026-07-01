# Arquitetura — Visão Geral

**Área:** Arquitetura
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions Deno).
- **Integrações externas:** n8n (Paty/Peças/Entregas), Meta WhatsApp Cloud, Vapi, Twilio, AWS S3 (De-Para), MobiGestor, SagaOne CRM externo.
- **Auth:** Azure AD SSO (domínio restrito `@gruposaga.com.br`), sessão 8h, idle 1h.

## Camadas

```
Browser (React)
  ├── Supabase JS SDK       → Auth + Postgres + Realtime
  ├── Edge Functions (Deno) → orquestração, integrações externas
  └── external-webhook-proxy → n8n (Paty), sem CSP issues

Postgres
  ├── RLS estrito por empresa (multi-tenant)
  ├── Triggers (auditoria, webhooks via pg_net)
  ├── RPCs SECURITY DEFINER (bypass RLS controlado)
  └── Cron (dispatcher de campanhas, opt-out sync)

Fila de disparo
  ├── campaign_jobs      (job por evento/lote)
  ├── campaign_batches   (unidade de 1 isolate = 1 lote)
  └── Edge process-campaign-job (self-chain até 100)
```

## Multi-tenant

Toda tabela sensível tem coluna `empresa_id` e RLS validando via `user_can_access_empresa(empresa_id, auth.uid())`. **Empresa ativa** vive no `CompanyContext` do FE e determina o que é lido/escrito (memory `logica-contexto-empresa-ativa`).

## Integrações — proxy pattern

Todo call para n8n / APIs externas passa por `external-webhook-proxy` (Edge) para:
- Evitar CSP no browser.
- Padronizar autenticação (`SAGA_ONE` token de saída).
- Ter retries e log centralizado (memory `external-api-proxy-and-csp-compliance`).

## Docs relacionados

- [Multi-tenant](./multi-tenant.md)
- [Autenticação e sessão](./autenticacao-e-sessao.md)
- [Permissões e RBAC](./permissoes-e-rbac.md)
- [Webhooks e integrações](./webhooks-e-integracoes.md)
- [Performance e limites](./performance.md)
- [Notificações](./notificacoes.md)