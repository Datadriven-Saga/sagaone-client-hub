
## Objetivo

Gerar `/mnt/documents/rbac-atual.md` documentando o sistema RBAC (Role-Based Access Control) **como ele existe hoje** no código, sem propostas de mudança.

## Estrutura

1. **Visão geral**
   - Modelo híbrido: papel base (`profiles.tipo_acesso`) + overrides granulares (`departamento_permissoes`) + super-papel (Master via `mfa_account_access`).
   - Diferença vs RBAC clássico: não usa `user_roles` separada — papel mora em `profiles`. Justificativa histórica e implicações.

2. **Camadas do RBAC**
   - **Camada 1 — Autenticação**: `AuthContext` + Azure SSO restrito a `@gruposaga.com.br`.
   - **Camada 2 — Papel base** (`tipo_acesso`): 12 níveis hierárquicos (Master, Admin, TI, Gerente, Coordenador, SDR, Vendedor, Recepcionista, Financeiro, Marketing, Pós-Vendas, Visitante). Tabela com cada papel + escopo.
   - **Camada 3 — Defaults por papel** (`PermissionRegistry.getDefaultPermissions`): cada papel recebe um conjunto de flags `can*`. Exemplo de mapeamento.
   - **Camada 4 — Overrides** (`departamento_permissoes`): tabela permite habilitar/desabilitar flags individuais por usuário/departamento, sobrescrevendo o default.
   - **Camada 5 — Master**: `mfa_account_access` + `useMfaMaster` concede bypass total (superadmin), inclusive ao Vault.
   - **Camada 6 — Multi-tenant**: empresa ativa (`CompanyContext`) + `user_empresas` + `user_can_access_empresa()` RLS.

3. **Pontos de aplicação (enforcement)**
   - **Rotas**: `ProtectedRoute`, `AdminProtectedRoute`, `TIAdminProtectedRoute`, `GestorProtectedRoute`, `PermissionProtectedRoute` (genérico por flag).
   - **UI**: `useUserAccessType()` retorna `permissions[key]` + helpers (`isAdmin`, `isMaster`, etc.) usados para esconder botões/menus.
   - **Sidebar**: `AppSidebar` filtra itens por flags `canSee*`.
   - **Banco (RLS)**: políticas usam `user_can_access_empresa()`, `has_role()`-equivalentes (`is_admin_user`, `is_master_user`), e checks diretos em `profiles.tipo_acesso`.
   - **Edge functions**: validam JWT + recheck de papel via service role (ex: `manage-users`, `prospeccao-anotacao`).

4. **Fluxo de resolução de permissão** (diagrama Mermaid)
   ```
   request → AuthContext (user) 
          → useUserAccessType
             → fetch profiles.tipo_acesso
             → fetch departamento_permissoes (overrides)
             → fetch mfa_account_access (Master?)
             → merge: defaults(tipo_acesso) ⊕ overrides ⊕ master-bypass
          → permissions{} → ProtectedRoute / UI check
   ```

5. **Catálogo de papéis** (tabela)
   - Para cada um dos 12 `tipo_acesso`: descrição, escopo (empresa única / multi / global), módulos default, restrições típicas, exemplos de overrides comuns.

6. **Tabelas centrais do RBAC**
   - `profiles` (tipo_acesso, empresa_id principal)
   - `user_empresas` (vínculo N:N usuário↔empresa)
   - `departamento_permissoes` (overrides granulares)
   - `mfa_account_access` (Master)
   - `prospeccao_equipe_membros` (visibilidade SDR/Vendedor de leads)
   - `agente_empresas` (vínculo agente IA↔empresa)
   - Functions: `user_can_access_empresa`, `is_admin_user`, `is_master_user`, `has_dept_permission` (se existir), `get_user_tipo_acesso`.

7. **Bypass e exceções documentadas**
   - Master → bypass total.
   - EMPRESA ADMIN (`b32ae8c9-...`) → sandbox restrito a Admin/TI/Master.
   - Edge functions com service role → bypass RLS controlado.
   - `user_can_access_empresa` overload intencional (única exceção à regra de não-overload).

8. **Anti-padrões evitados / armadilhas**
   - Por que não checa role no client via localStorage.
   - Por que RLS usa security definer functions (recursão).
   - Por que `DISTINCT` em agregações (eventos_prospeccao multi-row).
   - Sessão 8h / idle 1h.

9. **Como adicionar um novo papel ou flag** (checklist curto)
   - Adicionar enum/string em `tipo_acesso` (migração).
   - Atualizar `getDefaultPermissions` em `PermissionRegistry`.
   - Atualizar `useUserAccessType` se houver helper booleano novo.
   - Atualizar RLS se o papel tem escopo especial.
   - Refletir no UI de `ControleAcessos`.

## Fontes a consultar

`PermissionRegistry.ts`, `useUserAccessType.ts`, `AuthContext.tsx`, `CompanyContext.tsx`, `ProtectedRoute.tsx`, `AdminProtectedRoute.tsx`, `TIAdminProtectedRoute.tsx`, `GestorProtectedRoute.tsx`, `PermissionProtectedRoute.tsx`, `useMfaMaster.ts`, `useAdminCheck.ts`, `pages/admin/ControleAcessos.tsx`, `pages/admin/Acessos.tsx`, memórias `access-hierarchy-levels`, `rls-security-definer-pattern`, `mfa-and-vault-architecture-and-permissions`, `intentional-function-overloads`, `session-and-inactivity-policy`, `administracao-manager-access-scope`, `route-and-component-guard-alignment`.

## Entregável

- `/mnt/documents/rbac-atual.md` (~12–18 KB), com diagrama Mermaid do fluxo e tabela de papéis.
- Sem alterações de código.
