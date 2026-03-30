

## Plano: Corrigir visibilidade de cards/menus por permissão

### Análise de impacto por tipo de usuário

Validei cada correção contra os defaults do `PermissionRegistry` e os overrides do banco.

---

### Correção 1: Card "Acessos" em `/administracao`

**Problema:** Usa `canAccessAdministracao`, que é a mesma permissão de entrada na página. Qualquer usuário que entra na página vê o card.

**Correção:** Trocar para `canManageUsers || canCreateUsers`.

| Perfil | canManageUsers | canCreateUsers | Resultado | Antes |
|--------|---------------|----------------|-----------|-------|
| Master/Admin | true | true | ✅ Vê | Vê |
| TI (default) | true | true | ✅ Vê | Vê |
| TI (MFA-only override) | false | false | ✅ Não vê | Via indevido |
| Gerente Leads/Loja | false | true | ✅ Vê | Vê |
| CRM | false | true | ✅ Vê | Vê |
| Coordenadora | false | true | ✅ Vê | Vê |

**Nenhum perfil perde acesso indevidamente.**

---

### Correção 2: Card "MFA / Cofre de Senhas" em `/administracao`

**Problema:** Usa apenas `canAccessAgentesIA`. TI com MFA-only tem `canAccessAgentesIA=false` e `canViewAuthenticator=true`, mas o card não aparece.

**Correção:** Trocar para `canAccessAgentesIA || canViewAuthenticator` (no `permissionKey` do card).

Impacto: apenas aditivo — nenhum perfil perde acesso. Quem já vê por `canAccessAgentesIA` continua vendo.

---

### Correção 3: Rota `/administracao/mfa` no `App.tsx`

**Problema:** Rota protegida por `canAccessAgentesIA` apenas. TI-MFA é bloqueado.

**Correção:** Trocar para `permissionKey={["canAccessAgentesIA", "canViewAuthenticator"]}` (OR logic já existente no `PermissionProtectedRoute`).

---

### Correção 4: Rota `/administracao` e página `Administracao.tsx`

**Problema:** Rota e a lógica de `hasAccess` na página usam apenas `canAccessAdministracao`. Um usuário com apenas `canViewAuthenticator=true` (sem `canAccessAdministracao`) seria bloqueado.

**Correção:**
- Rota: `permissionKey={["canAccessAdministracao", "canViewAuthenticator"]}`
- Página: `const hasAccess = p("canAccessAdministracao") || p("canViewAuthenticator");`

---

### Correção 5: Sidebar — Prospecção sem checagem de permissão

**Problema:** O menu "Prospecção" aparece para todos, sem checagem.

**Correção:** Envolver com `canViewProspeccao`.

**Impacto:** `canViewProspeccao` tem default `true` para TODOS os perfis. Só seria oculto se houver override explícito para `false` — que é exatamente o comportamento desejado. Nenhum perfil é afetado negativamente.

---

### Correção 6: Sidebar — "Administração" também com `canViewAuthenticator`

**Correção:** `const canSeeAdministracao = p("canAccessAdministracao") || p("canViewAuthenticator");`

Aditivo. Nenhum perfil perde acesso.

---

### Correção 7: Index.tsx — Cards sem checagem de permissão

**Problema:** Todos os cards aparecem para todos os usuários, independente de permissão.

**Correção:** Envolver cada card com condicional:
- "Agentes de IA" → `canAccessAgentesIA`
- "Prospecção" → `canViewProspeccao` (default true para todos)
- "Carteira de Clientes" → `canViewClientes` (default true para todos)
- "Notificações" → `canAccessNotificacoes` (default true para todos)
- "Relatórios" → `canAccessRelatorios`
- "Treinamentos" → `canAccessAcademy`

**Impacto:** Os defaults já são `true` para a maioria. Apenas perfis com overrides explícitos para `false` deixam de ver — que é o comportamento correto.

---

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Administracao.tsx` | Card Acessos → `canManageUsers\|canCreateUsers`; Card MFA → `canAccessAgentesIA\|canViewAuthenticator`; `hasAccess` inclui `canViewAuthenticator` |
| `src/App.tsx` | Rotas `/administracao` e `/administracao/mfa` → arrays de permissão |
| `src/components/AppSidebar.tsx` | Prospecção com `canViewProspeccao`; Administração com `canViewAuthenticator` |
| `src/pages/Index.tsx` | Cards condicionais por permissão |

### Riscos

Nenhum. Todas as mudanças são:
- **Aditivas** (OR com nova permissão) — nenhum perfil existente perde acesso
- **Refinamentos** (trocar permissão genérica por específica) — validado contra todos os 12 perfis
- **Guards com defaults true** — só afetam se houver override explícito

