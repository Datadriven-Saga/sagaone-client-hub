
# Plano — Login de Terceiros (email/senha) ao lado do SSO Microsoft

## TL;DR de complexidade

**Complexidade: Média (não é trivial, mas tampouco é refactor estrutural).**
O Supabase Auth já suporta os dois métodos nativamente — o trabalho real está em **3 frentes pequenas e bem isoladas**:

1. Remover/relaxar a trava de domínio `@gruposaga.com.br` que hoje bloqueia qualquer e-mail externo.
2. Marcar quem é "terceiro" e poder ativar/desativar.
3. UI gerencial de criação de usuário protegida por uma permission flag nova (`canCreateExternalUsers`).

Tudo isso encaixa no modelo de permissões existente (`PermissionRegistry` + `departamento_permissoes`) — não precisa reescrever nada de auth/roles. Estimativa: **2 a 3 dias de implementação + QA**, sem riscos arquiteturais.

---

## 1. Diagnóstico do modelo atual

### Auth (`src/contexts/AuthContext.tsx`)
- Supabase Auth com **dois métodos já implementados**: `signIn(email,password)` e `signInWithAzure()`.
- **Trava dura**: `isValidDomain()` força `@gruposaga.com.br` em **toda** sessão (linha 214). Qualquer login fora disso é deslogado imediatamente.
- Sessão: 8h max + 1h ociosidade (memória já documenta isso).
- Login UI: hoje força `USE_SSO_LOGIN = true` (`src/pages/Login.tsx`) e esconde o formulário de senha.

### Permissões
- `PermissionRegistry.ts` define as flags; `departamento_permissoes` aplica overrides por `tipo_acesso`.
- Já existem `canCreateUsers`, `canManageUsers`, `canEditUsers`, `canDeleteUsers` (módulo `usuarios`). **Não cobrem distinção interno/externo** — toda criação hoje é via SSO automático (`auto_provision_user_from_sso`).
- `profiles.tipo_acesso` é o enum central; não há flag de "externo" nem "ativo/inativo".

### Edge function `manage-users`
- Já existe e é o ponto certo para criar usuários com `service_role` (criação no `auth.users` exige privilégio elevado). Precisa de uma branch nova para "criar terceiro com senha".

---

## 2. O que precisa mudar (escopo cirúrgico)

### 2.1 Banco (1 migration)
- `profiles`: adicionar `is_external boolean default false` e `is_active boolean default true`.
- Opcional: `external_created_by uuid` para auditoria.
- Função `has_external_login_enabled()` (feature flag global ligar/desligar o login externo de uma vez — vai bem no `system_feature_flags` já existente).
- Policies: garantir que só `canManageUsers` veja/edite `is_external`/`is_active`.

### 2.2 AuthContext (mudança mínima e crítica)
- Trocar `isValidDomain(email)` por:
  - aceita se `email` termina em `@gruposaga.com.br` **OU**
  - existe `profiles` com esse `user_id`, `is_external = true` e `is_active = true`.
- Se `is_active = false` → deslogar com toast "Conta desativada".
- Lookup feito por RPC `security definer` (`can_user_login(user_id)`) para evitar round-trip de policy.

### 2.3 Tela de Login
- Reativar o caminho email/senha (já existe no `AuthContext.signIn`). Renderizar abaixo do botão Microsoft com um collapse "Acessar como terceiro".
- Manter SSO como primário.

### 2.4 Permissão nova
- Em `PermissionRegistry.ts`, módulo `usuarios`:
  - `canCreateExternalUsers` ("Criar usuários externos / terceiros")
  - `canToggleUserActive` ("Ativar/Desativar usuário")
- Defaults: só Master/Admin. Aplicáveis a qualquer departamento via `departamento_permissoes` (mecanismo já existente — atende "grupo específico ou pessoa").

### 2.5 UI gerencial (uma tela / aba)
Em `/administracao` (ou aba dentro de Acessos):
- Listar usuários externos (`is_external = true`).
- Botão "Criar terceiro" → modal (nome, e-mail, senha temporária, `tipo_acesso`, empresa). Chama edge `manage-users` com `action: 'create_external'`.
- Toggle Ativo/Inativo (`is_active`).
- Botão "Resetar senha" (envia `resetPasswordForEmail`).
- Renderização e botões gated por `canCreateExternalUsers` / `canToggleUserActive`.

### 2.6 Edge function `manage-users`
- Adicionar branch `create_external`: valida permission do chamador, cria em `auth.users` com senha, popula `profiles` com `is_external=true`, dispara reset opcional.
- Branch `set_active`: idem com `is_active`.

---

## 3. Riscos e pontos de atenção

| Risco | Severidade | Mitigação |
|---|---|---|
| `auto_provision_user_from_sso` rodar em usuário externo e sobrescrever dados | Médio | Adicionar guard `WHERE is_external = false` na função |
| Auth state listener tentar revalidar domínio em refresh | Baixo | O novo `can_user_login` cobre os 2 casos |
| Vazamento: terceiro acessar dados de tenant errado | **Alto** | Forçar `empresa_id` na criação + RLS por `user_empresas` (já existe) |
| Reset de senha para `@gruposaga.com.br` quebrar SSO | Baixo | Bloquear reset na UI para `is_external = false` |
| Senha fraca / brute force | Médio | Habilitar "Leaked password protection" no Supabase Auth + rate-limit já nativo |

---

## 4. O que **não** precisa ser feito

- Reescrever sistema de roles. Tudo continua em `profiles.tipo_acesso` + `PermissionRegistry`.
- Tabela paralela de "usuários externos" — `auth.users` + flag em `profiles` resolvem.
- Provider OAuth novo. Email/senha já é nativo do Supabase.
- Mexer em sessão (8h/1h) — vale para os dois tipos.

---

## 5. Entregável adicional

Será gerado o documento `docs/login-terceiros-analise.md` com este conteúdo (após aprovação do plano), para ficar versionado no repo como referência da decisão.

---

## 6. Próximos passos (após aprovação)

1. Migration: campos `is_external` / `is_active` + RPC `can_user_login` + feature flag.
2. Patch no `AuthContext` (substitui `isValidDomain`).
3. Edge `manage-users` (branches `create_external` / `set_active`).
4. Permissions novas no Registry + defaults.
5. UI: aba "Usuários Externos" em Administração + reativar form senha no Login.
6. QA: SSO interno continua funcionando; terceiro ativo loga; terceiro inativo é bloqueado; sem permission → botões somem.
