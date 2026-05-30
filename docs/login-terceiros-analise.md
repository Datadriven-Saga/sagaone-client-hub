# Login de Terceiros (email/senha) ao lado do SSO Microsoft — Análise

> Documento de decisão técnica. Gerado a partir da análise do código atual de auth e do sistema de permissões.

## TL;DR

**Complexidade: Média.** Não é refactor estrutural, mas também não é "uma flag". Estimativa: **2 a 3 dias** de implementação + QA.

O Supabase Auth já suporta nativamente os dois métodos (OAuth Azure e email/senha). O `signIn(email, password)` inclusive **já existe** no `AuthContext`. O que bloqueia hoje é uma trava de domínio (`@gruposaga.com.br`) aplicada em toda sessão. O trabalho real está em três frentes pequenas e isoladas:

1. Relaxar a trava de domínio para aceitar terceiros marcados como tal.
2. Marcar quem é "terceiro" no `profiles` e poder ativar/desativar.
3. UI gerencial de criação de usuário externa, protegida por uma nova permission flag.

Tudo isso encaixa no modelo de permissões existente (`PermissionRegistry` + `departamento_permissoes`). **Não precisa reescrever roles, criar tabela paralela, nem adicionar provider OAuth novo.**

---

## 1. Diagnóstico do modelo atual

### 1.1 Auth (`src/contexts/AuthContext.tsx`)

- Implementa Supabase Auth com **dois caminhos**:
  - `signIn(email, password)` — pronto, mas não usado pela UI.
  - `signInWithAzure()` — caminho ativo (SSO Microsoft).
- **Trava dura de domínio** em `isValidDomain()` (linha 214): qualquer email fora de `@gruposaga.com.br` é deslogado imediatamente após autenticar.
- Sessão: 8h máx + 1h de inatividade (já em memória do projeto).

### 1.2 Tela de Login (`src/pages/Login.tsx`)

- `USE_SSO_LOGIN = true` força só o botão Microsoft. O formulário de email/senha está comentado/escondido — não removido.

### 1.3 Permissões

- `PermissionRegistry.ts` é o registry central; `departamento_permissoes` aplica overrides por `tipo_acesso` (e pode ser aplicado a **departamentos/grupos específicos** — atende o requisito de "aplicar a grupo ou pessoa").
- Já existem `canCreateUsers`, `canManageUsers`, `canEditUsers`, `canDeleteUsers` (módulo `usuarios`), mas **não diferenciam interno vs externo**. Hoje toda criação acontece via `auto_provision_user_from_sso` no primeiro login Azure.
- `profiles.tipo_acesso` é o enum central. **Não existe** flag de "externo" nem de "ativo/inativo".

### 1.4 Edge function `manage-users`

- Já existe, já roda com `service_role`. É o lugar certo para criar usuários — `auth.users` exige privilégio elevado, então não dá pra fazer pelo client direto.

---

## 2. O que precisa mudar (escopo cirúrgico)

### 2.1 Banco — 1 migration

- `profiles`:
  - `is_external boolean NOT NULL DEFAULT false`
  - `is_active boolean NOT NULL DEFAULT true`
  - `external_created_by uuid NULL` (auditoria de quem criou)
- RPC `can_user_login(_user_id uuid) returns boolean` — `security definer`. Retorna true se:
  - email termina em `@gruposaga.com.br` **OU**
  - `is_external = true AND is_active = true`
- Feature flag global em `system_feature_flags` (`external_login_enabled`) — kill switch.
- Policies: só quem tem `canManageUsers` enxerga/edita `is_external` e `is_active`.
- Guard em `auto_provision_user_from_sso`: `WHERE is_external = false`, para não sobrescrever dados de terceiro.

### 2.2 AuthContext

Substituir `isValidDomain(email)` por chamada à RPC `can_user_login(user.id)`. Se `false` → toast "Acesso negado / conta desativada" + signOut.

Mudança pequena, mas é o ponto sensível — qualquer bug aqui afeta 100% dos usuários.

### 2.3 Tela de Login

- Manter o botão Microsoft como CTA primário.
- Adicionar collapse "Acessar como terceiro" abaixo, com form email + senha. Reutiliza `signIn()` que já existe.
- Tela `/reset-password` já existe — só validar fluxo.

### 2.4 Permissões novas (`PermissionRegistry.ts`, módulo `usuarios`)

- `canCreateExternalUsers` — "Criar usuários externos / terceiros" (`criar`)
- `canToggleUserActive` — "Ativar/Desativar usuário" (`ativar_desativar`)

Defaults: apenas Master/Admin. Como o sistema usa `departamento_permissoes`, qualquer outro tipo de acesso pode ser liberado pontualmente pela tela de Controle de Acessos. Atende **"aplicar a um grupo específico ou pessoa"** sem código extra.

### 2.5 UI gerencial

Aba "Usuários Externos" em `/administracao` (ou dentro de Controle de Acessos):

- Listagem filtrando `is_external = true` (nome, email, empresa, `tipo_acesso`, ativo).
- Botão **"Criar terceiro"** (gated por `canCreateExternalUsers`) → modal: nome, email, senha temporária, `tipo_acesso`, empresa. Chama `manage-users` com `action: 'create_external'`.
- Toggle **Ativo/Inativo** (gated por `canToggleUserActive`).
- Botão **"Resetar senha"** → `resetPasswordForEmail()`.
- Bloquear reset/edição de senha em usuários `is_external = false` para não quebrar SSO.

### 2.6 Edge `manage-users` — 2 branches novas

- `create_external` — valida permission do chamador (via JWT), cria em `auth.users` (`email_confirm: true`), popula `profiles` com `is_external=true`, `external_created_by`, `tipo_acesso`, `empresa_id`. Opcionalmente dispara email de boas-vindas.
- `set_active` — valida permission, atualiza `profiles.is_active`. Se desativando, opcionalmente revoga sessões via `auth.admin.signOut(user_id)`.

---

## 3. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| `auto_provision_user_from_sso` rodar em terceiro e sobrescrever dados | Médio | Guard `WHERE is_external = false` na função |
| Sessão de terceiro desativado continuar válida até expirar | Médio | `auth.admin.signOut(user_id)` na desativação + check no `can_user_login` ao refresh |
| Vazamento multi-tenant: terceiro acessar empresa errada | **Alto** | Forçar `empresa_id` na criação + `user_empresas` (RLS já existente) |
| Reset de senha para usuário SSO interno quebrar login | Baixo | UI esconde botão quando `is_external = false` |
| Senha fraca / brute force | Médio | Habilitar "Leaked password protection" no Supabase Auth |
| Bypass do collapse no login (terceiro tentar SSO ou vice-versa) | Baixo | RPC `can_user_login` é a única fonte de verdade — método de login é irrelevante |

---

## 4. O que **não** precisa ser feito

- ❌ Reescrever sistema de roles — `profiles.tipo_acesso` + `PermissionRegistry` continuam intactos.
- ❌ Tabela paralela de "usuários externos" — `auth.users` + 2 flags em `profiles` resolvem.
- ❌ Provider OAuth novo — email/senha é nativo do Supabase.
- ❌ Mexer em política de sessão (8h/1h) — vale igual para os dois tipos.
- ❌ Nova tela de login — só reativar o que já existe.

---

## 5. Estimativa por etapa

| Etapa | Esforço | Risco |
|---|---|---|
| Migration (campos + RPC + guard) | 2h | Baixo |
| Patch `AuthContext` | 1h | **Crítico** — exige QA cuidadoso de regressão SSO |
| Permissions novas no Registry | 30min | Baixo |
| Edge `manage-users` (2 branches) | 3h | Médio |
| UI gerencial (lista + modal + toggle) | 6h | Baixo |
| Reativar form senha no Login | 1h | Baixo |
| QA matriz (SSO interno, terceiro ativo, terceiro inativo, sem permission) | 3h | — |
| **Total** | **~2,5 dias** | — |

---

## 6. Ordem de execução recomendada

1. Migration (campos + RPC + guard no `auto_provision_user_from_sso` + feature flag).
2. Patch `AuthContext` → `can_user_login`. **Testar SSO interno antes de continuar.**
3. Edge `manage-users`: branches `create_external` e `set_active`.
4. Permissions novas no Registry + defaults.
5. UI: aba "Usuários Externos" + reativar form de senha no Login (gated pela feature flag).
6. QA da matriz completa.

---

## 7. Decisão

Viável e de baixo risco arquitetural. Recomenda-se executar como **feature única** (não fatiada), pois as partes só fazem sentido juntas — entregar UI sem o patch do `AuthContext` deixa terceiros bloqueados; entregar o patch sem UI deixa o sistema "aberto" sem caminho de criação controlado.