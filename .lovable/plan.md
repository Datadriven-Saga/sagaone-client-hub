# Plano — Documento de Estrutura para Login de Terceiros

## Objetivo
Gerar um único artefato `/mnt/documents/login-terceiros-estrutura.md` consolidando **a estrutura necessária** para habilitar login de terceiros (email/senha) ao lado do SSO Microsoft já existente. Base: análise prévia em `docs/login-terceiros-analise.md` (já aprovada).

Não é re-análise — é o **blueprint de implementação** estruturado por camadas, para servir de referência durante a implementação.

## Estrutura do documento

1. **Contexto e premissas**
   - Estado atual: SSO Microsoft + hard-code `@gruposaga.com.br` em `AuthContext.isValidDomain`.
   - Premissa: manter SSO intacto, adicionar trilha senha gerenciável.

2. **Camada de Banco**
   - Tabela `allowed_login_domains` (campos, defaults, seed protegido `gruposaga.com.br`).
   - Alterações em `profiles`: `is_external`, `is_active`, `external_created_by`.
   - RPC `can_user_login(_user_id, _method)` — SECURITY DEFINER.
   - Trigger guard contra delete/desativação do domínio raiz.
   - Guard em `auto_provision_user_from_sso` (`WHERE is_external = false`).
   - GRANTs + RLS de `allowed_login_domains` (leitura pública mínima do flag "existe domínio password ativo", escrita só admin).

3. **Camada de Auth (frontend)**
   - Patch em `AuthContext`: substituir `isValidDomain` por `can_user_login(user.id, method)`.
   - Toasts: "Domínio não autorizado" vs "Conta desativada".
   - Login.tsx: CTA Microsoft + collapse "Acessar como terceiro" (renderizado condicionalmente).

4. **Camada de Permissões**
   - Novas chaves em `PermissionRegistry` (módulo `usuarios`):
     - `canCreateExternalUsers`
     - `canToggleUserActive`
     - `canManageLoginDomains`
   - Defaults: Master/Admin. Granularidade via `departamento_permissoes`.

5. **Camada de Edge Functions**
   - `manage-users` — branches `create_external` e `set_active`.
   - Validação: JWT do caller → permission → domínio na allowlist → `auth.admin.createUser` / `signOut`.

6. **Camada de UI gerencial** (`/administracao`)
   - Aba **Domínios Permitidos** (gated `canManageLoginDomains`).
   - Aba **Usuários Externos** (gated `canCreateExternalUsers` / `canToggleUserActive`).
   - Fluxos: criar terceiro, toggle ativo, resetar senha (só externos).

7. **Matriz de segurança**
   - Tabela risco × mitigação (do doc original).
   - Cenários: domínio raiz protegido, terceiro inativo, sessão revogada, multi-tenant, brute force.

8. **Ordem de execução e checklist de QA**
   - 8 passos sequenciais com gate de QA após patch do `AuthContext` (não quebrar SSO interno).
   - Matriz de QA: SSO interno OK / terceiro ativo / terceiro inativo / domínio desativado / domínio raiz protegido / sem permission.

9. **O que NÃO entra no escopo**
   - Reescrita de roles, tabela paralela de usuários, novo OAuth provider, mexer em sessão 8h/1h.

10. **Referências**
    - Link para `docs/login-terceiros-analise.md` (decisão técnica original).
    - Memórias relevantes: `auth/session-and-inactivity-policy`, `auth/sso-automated-provisioning-logic`, `security/permissions/access-hierarchy-levels`.

## Entregável
Um arquivo:
- `/mnt/documents/login-terceiros-estrutura.md`

Apresentado via `<presentation-artifact>` ao final.

## Fora de escopo
- Nenhuma alteração de código, migration ou edge function. Apenas documentação.
