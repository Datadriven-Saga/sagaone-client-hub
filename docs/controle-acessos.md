# Controle de Acessos / Permission Flags

Tela: `/administracao/controle-acessos`
Componente raiz: `src/pages/admin/ControleAcessos.tsx`
Guard de rota: `PermissionProtectedRoute permissionKey="canAccessControleAcessos"` (App.tsx)

---

## 1. Visão geral

A tela gerencia o **mapa de permissões por perfil** (`tipo_acesso`) usado em todo o SagaOne. Não controla permissões por usuário individual nem por departamento real — o nome da coluna `departamento` na tabela é legado; o valor armazenado é o **tipo de acesso** (perfil), não o departamento.

Possui 3 abas:

| Aba         | Arquivo                                                            | Função                                                                 |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Por Módulo  | `src/components/controle-acessos/PermissionModuleView.tsx`         | Lista permissões agrupadas por módulo. Toggle por perfil em cada flag. |
| Por Perfil  | `src/components/controle-acessos/PermissionProfileView.tsx`        | Seleciona 1 perfil e edita todas as flags dele. Tem "Clonar perfil".   |
| Comparar    | `src/components/controle-acessos/PermissionCompareView.tsx`        | Compara 2 perfis lado a lado (read-only) com filtro "só diferenças".   |

---

## 2. Arquitetura de dados

### Fonte da verdade dos defaults

`src/components/controle-acessos/PermissionRegistry.ts`

- `PERMISSION_MODULES` — 22 módulos (Authenticator, Templates, Eventos, IA Ligação, Disparos, Base/Contatos, etc.). `masterOnly` esconde o módulo de quem não é Master.
- `PERMISSION_REGISTRY` — ~120 entradas. Cada entrada tem `key`, `label`, `moduleId`, `action`, `description` opcional, e `hasValor`/`valorSchema` opcionais (para flags configuráveis tipo `canImportPool.dias_max`).
- `TIPOS_ACESSO` — 12 perfis: `SDR`, `Vendedor`, `CRM`, `Recepcionista`, `Gerente de Leads`, `Gerente de Loja`, `Coordenadora de Leads`, `Diretor`, `TI`, `Administrador`, `Proprietário`, `Master`.
- `getDefaultPermissions(tipo)` — devolve o baseline (true/false) por perfil. **Fonte da verdade do default; nada em banco.**
- `resolvePermissions(tipo, overrides)` — aplica os overrides do banco sobre os defaults.

### Overrides persistentes

Tabela `public.departamento_permissoes`:

| Coluna        | Tipo    | Notas                                                |
| ------------- | ------- | ---------------------------------------------------- |
| `departamento`| text    | Na prática é o `tipo_acesso` (perfil). Nome legado.  |
| `permissao`   | text    | Chave da `PermissionEntry` (ex.: `canDeleteEventos`).|
| `ativo`       | boolean | Override: true/false.                                |
| `valor`       | jsonb   | Configuração extra (`hasValor`). Ex.: `{ "dias_max": 90 }`. |
| `updated_at`  | timestamp | Trigger atualiza automaticamente.                 |

**RLS** (migrations `20260208…`, `20260212…`, `20260608…`):
- `SELECT` para qualquer usuário autenticado.
- `INSERT/UPDATE/DELETE` apenas para `Administrador`, `Master` e `TI`.

### Consumo runtime

`src/hooks/useUserAccessType.ts`:

1. Busca `profiles.tipo_acesso` + `profiles.departamento` do usuário logado.
2. Busca toda a `departamento_permissoes` em uma chamada.
3. Filtra os overrides do tipo de acesso atual.
4. Chama `resolvePermissions(tipo, overrides)`.
5. **Se `tipo === "Master"` força todas as permissões para `true`** (linha 67-71).
6. Expõe `permissions[key]` mais um conjunto de flags nomeadas (`canCreateEventos`, `canDispararEventos`, etc.).

Componentes consomem via `useUserAccessType()` e rotas via `PermissionProtectedRoute permissionKey="…"`.

---

## 3. O que funciona (efetivamente)

- **Toggle por (perfil × flag)** com upsert otimista em `departamento_permissoes` e rollback em erro (`ControleAcessos.tsx`).
- **Persistência do `valor jsonb`** para flags `hasValor` (campos numéricos e select) — editável somente na aba "Por Módulo", linha expandida.
- **Por Módulo**: busca por label/módulo, filtro por ação (Visualizar/Criar/Editar/Excluir/…), filtro por perfil (mostra só as flags **ativas** daquele perfil), expandir/recolher tudo, badge "X/12 perfis ativos" por flag, indicador de "customizada" (override diferente do default).
- **Por Perfil**: contadores (`ativas`, `customizadas`, `desativadas`), busca, toggle inline, dialog "Clonar perfil" que copia em batch todas as flags resolvidas do perfil de origem para o de destino.
- **Comparar**: 2 dropdowns + filtro "só diferenças", contador de divergências, destaque amber nas linhas que divergem. Read-only.
- **`masterOnly`** esconde módulos como Authenticator quando o usuário não é MFA Master.
- **Default + override = resolvido** funciona consistentemente em runtime via `resolvePermissions`.
- **Backward compatibility** com flags nomeadas no hook (`canManageUsers`, `canAccessKanban`, etc.) — quem ainda lê por nome continua funcionando.

---

## 4. O que NÃO funciona (cosmético, enganoso ou inerte)

### 4.1 Perfil `Master` é não editável de fato
`useUserAccessType` força `true` para todas as keys quando `tipo === "Master"`. Toggles no UI para `Master` são salvos no banco mas **ignorados em runtime**. O admin vê o switch, salva como `false`, recarrega, vê `false` na tela, mas o usuário Master continua com acesso. **UI deveria bloquear ou ocultar Master.**

### 4.2 Permissions órfãs (sem consumidor)
Várias flags estão no `PERMISSION_REGISTRY` mas nunca são lidas em código (ou só servem pra esconder card no menu Administração). Exemplos prováveis:
- `canManageWebhooks`
- `canManagePosVendasCadencia`, `canManagePosVendasTemplates`, `canManagePosVendasLojas`
- `canAccessAlgoritmosCompra/Venda/PosVendas`
- `canManageDocumentos`, `canManageProdutos`
- `canCreateGatilhos`, `canEditGatilhos`, `canDeleteGatilhos`

Resultado: o admin ativa/desativa achando que está controlando algo e **nada muda** no produto.

### 4.3 Bypass invisível pelo departamento TI
No hook:
```ts
canAccessAgentesIA: p("canAccessAgentesIA") || (isDepartamentoTI && isAdminOrTI)
```
Esse bypass **não é visível** na tela. Se um admin desligar a flag para `TI`, usuários do depto TI **continuam vendo Agentes IA**.

### 4.4 Risco de lock-out
`canAccessControleAcessos` default é só `Administrador`. Se um admin desligar essa flag para `Administrador`, **perde o acesso à própria tela** e só sai do buraco via Master ou SQL. Mesmo problema em `canAccessAdministracao`.

### 4.5 "Filtro por perfil" em Por Módulo é confuso
Selecionar um perfil no filtro de "Por Módulo" filtra para mostrar **apenas as permissões ativas** daquele perfil. Não existe label "ativas" — usuário pensa que sumiu permissão.

### 4.6 Falta de auditoria
`departamento_permissoes` tem `updated_at` mas **não tem `updated_by`** nem tabela de log. Quem mudou o quê e quando? Indeterminado.

### 4.7 Sem confirmação destrutiva
Toggles de flags críticas (`canManageUsers`, `canAccessControleAcessos`, `canDeleteUsers`, `canDispararEventos`) salvam ao primeiro clique. **Clonar perfil substitui tudo** sem confirmação granular e sem desfazer.

### 4.8 `valor jsonb` só editável em "Por Módulo"
`hasValor` (ex.: `canImportPool.dias_max`, `canImportPoolReadOnly.eventos_permitidos`) só aparece dentro da linha expandida da aba "Por Módulo". Em "Por Perfil" e "Comparar" o valor não é mostrado nem editável — quem entra direto em "Por Perfil" não vê que existe configuração extra.

### 4.9 Inconsistência visual Master no Authenticator
No print compartilhado, "Authenticator (MFA)" mostra `0/4` para `Vendedor` mesmo Master tendo tudo `true` em runtime. Isso porque a UI calcula `activeCount` a partir de `getDefaultPermissions + overrides`, **sem aplicar o force-true do Master** (que só existe em `useUserAccessType`). Outro sintoma do problema 4.1.

### 4.10 `valor jsonb` sem validação no banco
O schema do `valor` é definido em `valorSchema` no front. Banco aceita qualquer JSON. Override via SQL ou bug pode quebrar consumidores.

### 4.11 Cache de permissões no client
`useUserAccessType` só relê quando `user` muda. Mudanças em `departamento_permissoes` só refletem para o usuário-alvo no próximo login/refresh. **Não há realtime nem invalidação cross-session.**

### 4.12 Sem busca por chave técnica
Busca filtra por label e por nome do módulo. Não é possível buscar por `canManageUsers` direto — quem está debugando precisa cruzar manualmente com `PermissionRegistry.ts`.

### 4.13 Contadores incluem flags órfãs
"14/120 ativas / 108 customizadas / 106 desativadas" considera tudo o que está no Registry, inclusive flags que ninguém lê. Pode dar falsa sensação de controle ou de "muita coisa desativada".

---

## 5. Erros e inconsistências mapeadas (resumo executivo)

| Severidade | Item                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| Alta       | Master force-true não refletido na UI — toggles salvos viram lixo (4.1, 4.9)                  |
| Alta       | Lock-out de admin ao desligar `canAccessControleAcessos`/`canAccessAdministracao` (4.4)       |
| Alta       | Bypass invisível por depto TI em `canAccessAgentesIA` (4.3)                                   |
| Média      | Flags órfãs sem consumidor (4.2)                                                              |
| Média      | Sem auditoria de mudanças (4.6)                                                               |
| Média      | Sem confirmação destrutiva e Clonar irreversível (4.7)                                        |
| Média      | `valor jsonb` só editável em uma aba (4.8)                                                    |
| Baixa      | Cache, sem realtime (4.11)                                                                    |
| Baixa      | Filtro "Por perfil" em Por Módulo enganoso (4.5)                                              |
| Baixa      | Sem busca por chave técnica (4.12)                                                            |
| Baixa      | Contadores misturam flags órfãs (4.13)                                                        |

---

## 6. Fluxo de usabilidade

```text
Usuário (Admin/Master) navega para /administracao
        │
        ▼
Clica no card "Controle de Acessos"
        │  (PermissionProtectedRoute exige canAccessControleAcessos)
        ▼
┌──────────────────────────────────────────────────────────┐
│        Tabs: [Por Módulo] [Por Perfil] [Comparar]        │
└──────────────────────────────────────────────────────────┘
        │
   ┌────┴───────────────────────────┐
   ▼                ▼               ▼
[Por Módulo]    [Por Perfil]   [Comparar]
busca/ação      escolhe perfil escolhe 2 perfis
+ filtro perfil expande módulo  ver diff inline
expande módulo  toggle por flag (read-only)
toggle por      "Clonar perfil" filtro "só diff"
(perfil x flag) (substitui dst)
edita valor
(hasValor)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ handleToggle / handleValorChange / handleCloneProfile   │
│   1) Update otimista do estado local                    │
│   2) UPSERT em departamento_permissoes (onConflict      │
│      departamento+permissao)                            │
│   3) Rollback se a chamada falhar                       │
└─────────────────────────────────────────────────────────┘
        │
        ▼
 (próximo login/refresh do usuário afetado)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ useUserAccessType                                        │
│   - lê profiles.tipo_acesso                              │
│   - lê departamento_permissoes                           │
│   - resolvePermissions(tipo, overrides)                  │
│   - se Master → força true em tudo                       │
│   - expõe permissions[key] e flags nomeadas              │
└─────────────────────────────────────────────────────────┘
        │
        ▼
Componentes:        Rotas:
 p("chave")          <PermissionProtectedRoute permissionKey="…">
 flags nomeadas      <AdminProtectedRoute />, <TIAdminProtectedRoute />…
```

---

## 7. Como adicionar uma nova permission flag (referência rápida)

1. Em `PermissionRegistry.ts`:
   - Adiciona uma entrada em `PERMISSION_REGISTRY` (`key`, `label`, `moduleId`, `action`, opcional `hasValor` + `valorSchema`).
   - Define default por perfil em `getDefaultPermissions()`.
2. Em `useUserAccessType.ts`:
   - (opcional) Expõe uma flag nomeada se for muito usada, ou apenas leia via `permissions["minhaChave"]`.
3. Consome no componente/rota.
4. **Não precisa migration** — defaults moram em código; banco só guarda overrides.

---

## 8. Recomendações (não implementadas; backlog técnico)

- [ ] Bloquear/ocultar edição do perfil `Master` na UI (read-only).
- [ ] Bloquear toggle de `canAccessControleAcessos` para o próprio perfil do usuário logado.
- [ ] Coluna `updated_by` + tabela de log dedicada para auditoria.
- [ ] Marcador visual de flags "órfãs" via checagem estática (lint cruzando registry × código).
- [ ] Mover bypass do depto TI para uma flag explícita ou pelo menos documentar via `description`.
- [ ] Invalidação/realtime nas permissões (`postgres_changes` em `departamento_permissoes`).
- [ ] Confirmação no Clonar perfil + opção "merge" vs "substituir".
- [ ] Editar `valor jsonb` também em "Por Perfil".
- [ ] Busca por chave técnica (não só label).
- [ ] Forçar `Master` true também no `getDefaultPermissions`, para os contadores da UI baterem com runtime.