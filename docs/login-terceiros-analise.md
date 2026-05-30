# Login de Terceiros (email/senha) + Allowlist de Domínios — Análise

> Documento de decisão técnica. Espelho do `.lovable/plan.md`.

## TL;DR

**Complexidade: Média. Estimativa: ~3 dias.**

O Supabase Auth já tem os dois métodos. O `signIn` por senha já existe no `AuthContext`. O que bloqueia é o hard-code `@gruposaga.com.br`. A solução cobre 4 frentes:

1. **Allowlist gerenciável de domínios** (tabela + UI) substituindo o hard-code.
2. Flags `is_external` / `is_active` em `profiles`.
3. UI gerencial de criação de terceiros (gated por permission).
4. UI gerencial de domínios permitidos (gated por permission).

---

## 1. Modelo atual

- `AuthContext.isValidDomain()` força `@gruposaga.com.br` em toda sessão.
- `signIn(email, password)` existe mas a UI esconde (`USE_SSO_LOGIN = true`).
- `PermissionRegistry` + `departamento_permissoes` cobrem grupos/pessoas.
- `profiles.tipo_acesso` é o enum central — sem `is_external` / `is_active`.
- Edge `manage-users` já roda com `service_role` (lugar certo para criar usuários).

---

## 2. Mudanças (cirúrgicas)

### 2.1 Banco — 1 migration

**Allowlist:**
```sql
CREATE TABLE public.allowed_login_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio text NOT NULL UNIQUE,
  descricao text,
  tipo text NOT NULL DEFAULT 'sso',  -- 'sso' | 'password' | 'ambos'
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

- Seed obrigatório protegido: `('gruposaga.com.br', 'Domínio corporativo', 'sso', true)` — não pode ser apagado nem desativado (trigger/guard).
- `tipo` separa SSO de senha: parceiro pode ter só `password`, time interno só `sso`.

**Profiles:**
- `is_external boolean NOT NULL DEFAULT false`
- `is_active boolean NOT NULL DEFAULT true`
- `external_created_by uuid NULL`

**RPC `can_user_login(_user_id uuid, _method text) returns boolean`** (`security definer`):
- Lê email do `auth.users`, extrai domínio.
- Retorna true se existe linha em `allowed_login_domains` com `ativo=true`, `dominio` igual, e `tipo IN ('ambos', _method)`.
- Se `is_external=true`, também exige `is_active=true`.

**Guard** em `auto_provision_user_from_sso`: `WHERE is_external = false`.

### 2.2 AuthContext

Trocar `isValidDomain(email)` pela chamada `can_user_login(user.id, method)`, passando `'sso' | 'password'` conforme o caminho usado. Toasts distintos: "Domínio não autorizado" vs "Conta desativada".

### 2.3 Login

- Botão Microsoft como CTA primário.
- Collapse "Acessar como terceiro" com form email/senha — só renderiza se existir ao menos um domínio com `tipo IN ('password','ambos')` ativo (consulta pública leve via RPC).

### 2.4 Permissões novas (`PermissionRegistry`, módulo `usuarios`)

- `canCreateExternalUsers` — Criar usuários externos / terceiros
- `canToggleUserActive` — Ativar/Desativar usuário
- `canManageLoginDomains` — Gerenciar domínios de login permitidos

Defaults: só Master/Admin. Liberação granular via `departamento_permissoes`.

### 2.5 UI gerencial — duas abas em `/administracao`

**A. Domínios Permitidos** (gated por `canManageLoginDomains`):
- Tabela: domínio, descrição, tipo (SSO/Senha/Ambos), ativo, criado por.
- Botão "Adicionar domínio" com validação de formato + confirmação dupla.
- Toggle ativo/inativo, edição inline de tipo/descrição.
- Domínio raiz `gruposaga.com.br` bloqueado para delete/desativar.
- Aviso: "Domínios novos liberam login imediatamente."

**B. Usuários Externos** (gated por `canCreateExternalUsers` / `canToggleUserActive`):
- Lista `is_external=true` com nome/email/empresa/tipo_acesso/ativo.
- "Criar terceiro" → modal (nome, email, senha temporária, tipo_acesso, empresa). Valida domínio contra allowlist com `tipo IN ('password','ambos')`.
- Toggle Ativo/Inativo.
- "Resetar senha" só para `is_external=true` (não quebra SSO interno).

### 2.6 Edge `manage-users` — branches novas

- `create_external`: valida permission via JWT, valida domínio na allowlist, cria em `auth.users`, popula `profiles`.
- `set_active`: valida permission, atualiza `is_active`, revoga sessões (`auth.admin.signOut`).

---

## 3. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Apagar/desativar `gruposaga.com.br` e travar todo mundo | **Alto** | Guard no UI + trigger no banco impedindo |
| Typo de domínio liberar login indevido | Alto | Confirmação dupla + auditoria de `criado_por` |
| `auto_provision_user_from_sso` rodar em terceiro | Médio | Guard `WHERE is_external = false` |
| Sessão de terceiro desativado continuar válida | Médio | `auth.admin.signOut` + `can_user_login` em refresh |
| Multi-tenant: terceiro acessar empresa errada | **Alto** | `empresa_id` na criação + RLS `user_empresas` existente |
| Brute force em terceiros | Médio | "Leaked password protection" no Supabase Auth |
| Domínio desativado mas usuário já logado | Baixo | RPC roda a cada refresh de sessão |

---

## 4. O que **não** precisa ser feito

- Reescrever roles.
- Tabela paralela de usuários externos.
- Provider OAuth novo.
- Mexer em sessão (8h/1h).

---

## 5. Estimativa

| Etapa | Esforço |
|---|---|
| Migration (allowlist + profiles + RPC + guards + seed) | 3h |
| Patch `AuthContext` | 1h |
| Permissions novas | 30min |
| Edge `manage-users` (2 branches) | 3h |
| UI Domínios Permitidos | 4h |
| UI Usuários Externos | 6h |
| Reativar form senha no Login | 1h |
| QA matriz completa | 4h |
| **Total** | **~3 dias** |

---

## 6. Ordem de execução

1. Migration (allowlist + profiles + RPC + seed protegido + guards).
2. Patch `AuthContext` → `can_user_login(user.id, method)`. **QA SSO interno antes de continuar.**
3. Edge `manage-users` (`create_external`, `set_active`).
4. Permissions novas + defaults.
5. UI Domínios Permitidos.
6. UI Usuários Externos.
7. Reativar form senha no Login (gated pela existência de domínios `password`/`ambos`).
8. QA matriz: SSO interno OK, terceiro ativo loga, terceiro inativo bloqueado, domínio desativado bloqueia, domínio raiz protegido, sem permission → UI some.