# MFA e Vault

**Área:** Administração
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Cofre criptografado (**Vault**) para senhas e códigos MFA de contas terceiras usadas pela operação (portais Meta, plataformas OEM, etc.). Não substitui o MFA da sessão SagaOne — protege **credenciais externas**.

## Perfis

| Perfil | Escopo | Doc |
|---|---|---|
| **Master MFA** | Vê e gerencia todos os cofres | memory `mfa/ownership-access-restriction` |
| **Geral MFA** | Vê apenas cofres onde tem `mfa_account_access` | — |

## Fluxo funcional

1. Master cria conta em `mfa_accounts` e define quem tem acesso em `mfa_account_access`.
2. Usuário autorizado abre `/administracao/mfa-*`, confirma senha/2FA da sessão e visualiza a credencial descriptografada.
3. Todo acesso grava em `mfa_audit_logs`.
4. Códigos de recuperação em `mfa_recovery_codes` — um-uso.

## Detalhes técnicos

- **Tabelas:** `mfa_accounts`, `mfa_account_access`, `mfa_password_vault`, `mfa_recovery_codes`, `mfa_audit_logs`, `mfa_master_users`, `mfa_feature_flags`.
- **Criptografia:** AES-256 no servidor (memory `mfa-and-vault-architecture-and-permissions`).
- **Hook:** `src/hooks/useMfaMaster.ts`.
- **RLS:** `mfa_password_vault` restrito a Master; leitura via RPC `SECURITY DEFINER` que valida `mfa_account_access`.

## Regras invariantes

- Segredos **nunca** trafegam em query direta — sempre por RPC.
- Chave AES vive apenas em secrets da Edge Function, nunca em tabela.
- Todo `SELECT` de senha gera log com IP/UA do usuário.

## Relacionado

- [Visão geral Administração](./visao-geral.md)