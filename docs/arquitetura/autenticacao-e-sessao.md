# Autenticação e Sessão

**Área:** Arquitetura
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## Providers

- **Azure AD SSO** (principal) — restrito a `@gruposaga.com.br`.
- **Login local** (Supabase Auth) — apenas Master/emergência.
- **Login de terceiros** — via `/administracao/external-access` com `external_access_seats` limitados por empresa. Ver [operacoes/login-terceiros.md](../operacoes/login-terceiros.md).

## Sessão

- **Duração máxima:** 8 h.
- **Idle timeout:** 1 h sem atividade → logout.
- **Deep linking:** URL de destino é salva em `localStorage` antes do redirect para o provider e restaurada após login (memory `smart-redirect-deep-linking`).
- **TOKEN_REFRESHED** não força refresh de páginas — `AuthContext` ignora reruns desse evento para evitar unmount de contexto (regressão corrigida em jun/2026).

## Azure SSO — claims

`sub`, `email`, `preferred_username`, `roles[]` são mapeados para `user_metadata` do Supabase (memory `azure-sso-claims-mapping`).

### Auto-provisioning

No primeiro login, `roles[]` do Azure mapeia para `tipo_acesso` interno (memory `sso-automated-provisioning-logic`). Um usuário sem role Azure mapeada cai em `Colaborador` (leitura mínima).

### Preview / Lovable

Iframe da preview Lovable bloqueia o SSO Microsoft por `X-Frame-Options` (memory `sso-iframe-preview-restriction`). Sempre testar fora do iframe.

## Restrições operacionais

- Domínio de e-mail estritamente `@gruposaga.com.br` para login SSO (memory core).
- Sessão MFA para operações Master (`mfa_master_users`).
- Tokens de webhook (`SAGA_ONE_ADMIN_TOKEN` in, `SAGA_ONE` out) vivem apenas em secrets da Edge (memory `webhook-token-strategy`).

## Relacionado

- [Multi-tenant](./multi-tenant.md)
- [Permissões e RBAC](./permissoes-e-rbac.md)
- [MFA e Vault](../administracao/mfa-vault.md)