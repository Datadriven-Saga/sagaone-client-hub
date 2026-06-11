## Objetivo

Criar `docs/controle-acessos.md` documentando a tela Permission Flags (`/administracao/controle-acessos`): o que funciona, o que não funciona, inconsistências e fluxo de uso.

## Estrutura do documento

### 1. Visão geral
- Rota: `/administracao/controle-acessos` (lazy em `App.tsx`)
- Guard: `PermissionProtectedRoute permissionKey="canAccessControleAcessos"` (default só `Administrador` e `Master`)
- Componente: `src/pages/admin/ControleAcessos.tsx`
- 3 views: **Por Módulo**, **Por Perfil**, **Comparar**

### 2. Arquitetura de dados
- **Fonte da verdade dos defaults**: `src/components/controle-acessos/PermissionRegistry.ts`
  - `PERMISSION_MODULES` (22 módulos)
  - `PERMISSION_REGISTRY` (≈120 flags)
  - `TIPOS_ACESSO` (12 perfis: SDR, Vendedor, CRM, Recepcionista, Gerente de Leads, Gerente de Loja, Coordenadora de Leads, Diretor, TI, Administrador, Proprietário, Master)
  - `getDefaultPermissions(tipo)` resolve baseline por perfil
  - `resolvePermissions(tipo, overrides)` aplica overrides do banco
- **Overrides persistentes**: tabela `public.departamento_permissoes (departamento, permissao, ativo, valor jsonb)`
  - Apesar do nome `departamento`, o valor é o **tipo de acesso** (perfil), não o departamento do usuário
  - RLS: SELECT para todos autenticados, WRITE só `Administrador/Master/TI`
- **Consumo runtime**: `src/hooks/useUserAccessType.ts` busca `profiles.tipo_acesso` + overrides, aplica `resolvePermissions`, e força `true` para Master

### 3. O que funciona
- Toggle de permissão por (perfil × flag) com upsert otimista em `departamento_permissoes`
- 3 abas funcionais: Por Módulo (filtros por busca/ação/perfil), Por Perfil (estatísticas e busca), Comparar (diff entre 2 perfis com filtro "só diferenças")
- "Clonar perfil" via upsert em batch (substitui todas as flags do perfil destino)
- Flag `hasValor` + `valorSchema` com campos numéricos/select por perfil (ex.: `canImportPool.dias_max`, `canImportPoolReadOnly.eventos_permitidos`) — persistidos em `valor jsonb` e lidos por `permissionValores`
- Módulos `masterOnly` (Authenticator) só aparecem para usuários MFA Master
- `expandAll` / `collapseAll` em Por Módulo
- Indicador de "customizada" (override ativo diferente do default) com tooltip

### 4. O que NÃO funciona / é apenas cosmético
- **Master** sempre resolve `true` no front (`useUserAccessType` linha 67-71). Toggles em `Master` no UI são salvos no banco mas **ignorados em runtime** — o usuário vê o switch desligado depois e parece quebrado, mas a permissão continua liberada.
- **Permissions órfãs**: muitas flags estão no Registry mas nunca são consumidas. Exemplos do retorno do `useUserAccessType`: várias flags ficam só em `permissions` (mapa cru); o consumo só acontece se a UI chamar `permissions["chave"]`. Auditar consumidores ajuda — várias keys (ex.: `canManageWebhooks`, `canManagePosVendasCadencia`, `canAccessAlgoritmos*`, `canManageDocumentos`) não têm checagem real no produto, ou têm somente em `Administracao.tsx` para esconder o card.
- **`bypass via departamento TI`**: `canAccessAgentesIA` no hook é `p("canAccessAgentesIA") || (isDepartamentoTI && isAdminOrTI)` — esse bypass não aparece na tela; o admin pode "desligar" a flag e mesmo assim usuários do depto TI continuam vendo.
- **Inconsistência `canAccessAdministracao`**: o `PermissionProtectedRoute` desta tela depende de `canAccessControleAcessos`, mas o card "Acessos > Acessar Controle de Acessos" no Registry está em ação `administrar`. Default só `Administrador`. Se um admin desligar para si mesmo, perde o acesso à própria tela (sem fallback além de outro Master).
- **Filtro "Por perfil" em Por Módulo** filtra apenas permissões **ativas** daquele perfil. Não é óbvio na UI — usuário pode pensar que sumiu permissão.
- **Não há histórico/audit log** de quem alterou cada flag (tabela sem `updated_by`).
- **Sem confirmação destrutiva** no toggle quando se desliga uma flag crítica (`canManageUsers`, `canAccessControleAcessos`, etc.).
- **Clonar perfil** não confirma sobrescrita item a item; substitui todas as flags do destino — irreversível.
- **`hasValor`** só aparece dentro da linha expandida em "Por Módulo". Em "Por Perfil" e "Comparar" o `valor` não é editável nem mostrado.
- **`Authenticator (MFA)` no print**: aparece "0/4" para Master no header do print mesmo Master tendo tudo `true` em runtime — o card mostra defaults+overrides do registro, mas o forçamento Master só ocorre em `useUserAccessType`, não no `getDefaultPermissions`. Outro sintoma da inconsistência acima.
- **`Master`** não é editável de forma efetiva, mas a UI deixa o usuário tentar e gravar lixo em `departamento_permissoes`.
- **Contadores** ("14/120 ativas", "108 customizadas", "106 desativadas") consideram todas as flags do Registry, incluindo as que nunca são lidas em código — pode confundir o admin.
- **Cache de permissões no client**: `useUserAccessType` só relê quando `user` muda. Alterações em `departamento_permissoes` exigem refresh para o usuário afetado ver — não há realtime nem invalidação cross-session.
- **Sem busca por chave técnica** (só busca por label e nome do módulo).

### 5. Erros e riscos
- Risco de **lock-out**: Admin desliga `canAccessControleAcessos` ou `canAccessAdministracao` para `Administrador` e perde acesso. Só recuperável via Master ou SQL direto.
- Risco de **divergência runtime**: flag ligada no banco mas não consumida em código = falsa sensação de controle.
- Risco de **bypass invisível** (depto TI em `canAccessAgentesIA`, Master sempre true).
- `valor jsonb` sem validação de schema no banco — UI confia no `valorSchema` do registry.
- `Master` no registry tem comportamento divergente: `Authenticator` permissions são `false` por default e o registro grava overrides inertes.

### 6. Fluxo de usabilidade

```text
Admin/Master entra em /administracao
        │
        ▼
Clica "Controle de Acessos" (precisa canAccessControleAcessos)
        │
        ▼
┌──────────────────────────────────────────┐
│  Tabs: Por Módulo │ Por Perfil │ Comparar│
└──────────────────────────────────────────┘
        │
   ┌────┴────────────────────────────┐
   ▼                ▼                ▼
Por Módulo     Por Perfil       Comparar
busca/filtro   escolhe 1 perfil escolhe 2 perfis
expande módulo expande módulo   ver diff inline
toggles por    toggle 1 switch  (read-only)
perfil x flag  por flag         filtro "só diff"
edita valor    "Clonar perfil"
(hasValor)     copia tudo p/
               outro perfil
        │
        ▼
Toggle/Clone → upsert em departamento_permissoes
   (optimistic UI, rollback em erro)
        │
        ▼
Próximo login/refresh do usuário afetado:
  useUserAccessType lê profiles.tipo_acesso
  + departamento_permissoes
  → resolvePermissions(defaults, overrides)
  → Master force-true
  → expõe `permissions["chave"]`
        │
        ▼
Componentes/rotas chamam p("chave") ou
PermissionProtectedRoute para gate
```

### 7. Recomendações (não implementar agora, só listar)
- Travar edição do perfil `Master` na UI (read-only).
- Bloquear toggle de `canAccessControleAcessos` para o perfil do próprio usuário logado.
- Adicionar coluna `updated_by`/`updated_at` (já existe `updated_at`) com log dedicado.
- Marcar visualmente flags "órfãs" (sem consumidor em código) — checagem estática.
- Mover bypass do depto TI para uma flag explícita, ou documentar no tooltip.
- Realtime/invalidação ao alterar override para usuários online.
- Confirmação no Clonar perfil + opção de "merge" vs "substituir".
- Permitir editar `valor jsonb` também em "Por Perfil".

## Entregável
- `docs/controle-acessos.md` (markdown, sem código novo, sem mudanças de UI/DB)
