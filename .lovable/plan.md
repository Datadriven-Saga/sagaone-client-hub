
# Plano — Login de Terceiros (email/senha) + Allowlist de Domínios Gerencial

## TL;DR de complexidade

**Complexidade: Média.** O Supabase Auth já suporta os dois métodos nativamente. O trabalho real está em **4 frentes pequenas e isoladas**:

1. Substituir o hard-code `@gruposaga.com.br` por uma **allowlist gerenciável de domínios** (tabela + UI).
2. Marcar quem é "terceiro" no `profiles` e poder ativar/desativar.
3. UI gerencial de criação de usuário externa, gated por permission flag.
4. UI gerencial dos domínios permitidos, gated por permission flag.

Estimativa: **3 dias de implementação + QA**, sem riscos arquiteturais.

---

## 1. Diagnóstico do modelo atual

### Auth (`src/contexts/AuthContext.tsx`)
- Dois métodos já implementados: `signIn(email,password)` e `signInWithAzure()`.
- **Trava dura**: `isValidDomain()` força `@gruposaga.com.br` (linha 214). Qualquer login fora disso é deslogado.
- Sessão: 8h max + 1h ociosidade.
- Login UI: `USE_SSO_LOGIN = true` esconde o form de senha (`src/pages/Login.tsx`).

### Permissões
- `PermissionRegistry.ts` + `departamento_permissoes` aplicam overrides por `tipo_acesso` (também por grupo/pessoa).
- `profiles.tipo_acesso` é o enum central. Não há flag `is_external` nem `is_active`.

### Edge `manage-users`
- Já existe, roda com `service_role`. Ponto correto para criar usuários (auth.users exige privilégio elevado).

---

## 2. O que precisa mudar (escopo cirúrgico)

### 2.1 Banco — 1 migration

**Allowlist de domínios:**
```sql
CREATE TABLE public.allowed_login_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio text NOT NULL UNIQUE,        -- ex: "gruposaga.com.br" (sem @)
  descricao text,
  tipo text NOT NULL DEFAULT 'sso',    -- 'sso' | 'password' | 'ambos'
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```
- Seed obrigatório: `('gruposaga.com.br', 'Domínio corporativo', 'sso', true)` — não pode ser apagado (constraint ou guard).
- `tipo` permite restringir um domínio só para SSO ou só para senha (ex: parceiro só pode logar via senha).

**Profiles:**
- `is_external boolean NOT NULL DEFAULT false`
- `is_active boolean NOT NULL DEFAULT true`
- `external_created_by uuid NULL`

**RPC `can_user_login(_user_id uuid, _method text) returns boolean`** (`security definer`):
- Lê email do `auth.users`.
- Extrai domínio.
- Retorna `true` se: existe linha em `allowed_login_domains` com `ativo=true`, `dominio` igual, e `tipo IN ('ambos', _method)`.
- Adicionalmente: se `is_external=true`, exige `is_active=true`.

**Guard no `auto_provision_user_from_sso`:** `WHERE is_external = false`.

### 2.2 AuthContext
- Trocar `isValidDomain(email)` (sync hardcoded) por chamada à RPC `can_user_login(user.id, method)`.
- Passar `method='sso' | 'password'` conforme o caminho de login usado (flag temporária no signIn).
- Se RPC retornar `false` → toast claro ("Domínio não autorizado" vs "Conta desativada") + signOut.

### 2.3 Login (`src/pages/Login.tsx`)
- Manter botão Microsoft como primário.
- Adicionar collapse "Acessar como terceiro" → form email/senha (`signIn` já existe).
- O collapse aparece somente se houver pelo menos um domínio com `tipo IN ('password','ambos')` ativo (consulta pública leve via RPC).

### 2.4 Permissões novas (`PermissionRegistry.ts`, módulo `usuarios`)
- `canCreateExternalUsers` — Criar usuários externos / terceiros
- `canToggleUserActive` — Ativar/Desativar usuário
- `canManageLoginDomains` — Gerenciar domínios de login permitidos

Defaults: apenas Master/Admin. Como o sistema usa `departamento_permissoes`, qualquer perfil pode ser liberado pontualmente.

### 2.5 UI gerencial — duas telas/abas em `/administracao`

**A. Aba "Domínios Permitidos"** (gated por `canManageLoginDomains`):
- Tabela: domínio, descrição, tipo (SSO/Senha/Ambos), ativo, criado por.
- Botão "Adicionar domínio" → modal com validação de formato.
- Toggle ativo/inativo.
- Edição inline do tipo e descrição.
- Exclusão bloqueada para `gruposaga.com.br` (proteção).
- Aviso visível: "Domínios novos liberam login imediatamente. Use com cautela."

**B. Aba "Usuários Externos"** (gated por `canCreateExternalUsers` para criar, `canToggleUserActive` para toggle):
- Listar `is_external=true` com nome/email/empresa/tipo_acesso/ativo.
- Botão "Criar terceiro" → modal (nome, email, senha temporária, `tipo_acesso`, empresa). Valida que o domínio do email está na allowlist com `tipo IN ('password','ambos')`. Chama `manage-users` `action: 'create_external'`.
- Toggle Ativo/Inativo.
- Botão "Resetar senha" → só visível para `is_external=true`.

### 2.6 Edge `manage-users` — branches novas
- `create_external`: valida permission via JWT, valida domínio na allowlist, cria em `auth.users`, popula `profiles`.
- `set_active`: valida permission, atualiza `is_active`, opcionalmente revoga sessões (`auth.admin.signOut`).

---

## 3. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Apagar `gruposaga.com.br` da allowlist e travar todo mundo | **Alto** | Guard no UI + constraint no banco impedindo delete/inativação do domínio raiz |
| Adicionar domínio errado (typo) liberar login indevido | Alto | Confirmação dupla no modal + log de auditoria de quem criou |
| `auto_provision_user_from_sso` rodar em terceiro | Médio | Guard `WHERE is_external = false` |
| Sessão de terceiro desativado continuar válida | Médio | `auth.admin.signOut` na desativação + check no `can_user_login` ao refresh |
| Multi-tenant: terceiro acessar empresa errada | **Alto** | Forçar `empresa_id` na criação + RLS `user_empresas` existente |
| Brute force em terceiros | Médio | Habilitar "Leaked password protection" no Supabase Auth |
| Race: domínio desativado mas usuário já logado | Baixo | RPC roda em todo refresh de sessão |

---

## 4. O que **não** precisa ser feito

- Reescrever roles — `profiles.tipo_acesso` + `PermissionRegistry` intactos.
- Tabela paralela de usuários externos.
- Provider OAuth novo.
- Mexer em sessão (8h/1h).

---

## 5. Estimativa por etapa

| Etapa | Esforço |
|---|---|
| Migration (allowlist + profiles + RPC + guards + seed) | 3h |
| Patch `AuthContext` | 1h |
| Permissions novas no Registry | 30min |
| Edge `manage-users` (2 branches) | 3h |
| UI: aba Domínios Permitidos | 4h |
| UI: aba Usuários Externos | 6h |
| Reativar form senha no Login | 1h |
| QA matriz completa | 4h |
| **Total** | **~3 dias** |

---

## 6. Ordem de execução

1. Migration completa (allowlist + profiles + RPC + seed protegido).
2. Patch `AuthContext` → `can_user_login(user.id, method)`. **QA SSO interno antes de continuar.**
3. Edge `manage-users` (`create_external`, `set_active`).
4. Permissions novas no Registry + defaults.
5. UI Domínios Permitidos.
6. UI Usuários Externos.
7. Reativar form senha no Login (gated pela existência de domínios `password`/`ambos`).
8. Atualizar `docs/login-terceiros-analise.md` com a allowlist.
9. QA: SSO interno OK; terceiro ativo loga; terceiro inativo bloqueado; domínio desativado bloqueia login; domínio raiz não pode ser removido; sem permission → telas/botões somem.
