
# Plano: RBAC Fine-Grained com Governança em Banco e Adapter Layer

Objetivo: eliminar bypasses por código, mover catálogo de permissões e overrides do `PermissionRegistry.ts` + `departamento_permissoes` para o banco, com taxonomia `escopo:recurso:ação`, auditoria via trigger, proteção contra autolockout e camada adaptadora que mantém o código atual funcionando enquanto migramos.

Entregável desta etapa: **apenas o documento de plano em `/mnt/documents/plano-rbac-fine-grained.md`** (sem código, sem migration ainda). A migration/código real virão em etapas seguintes após aprovação.

---

## 1. Taxonomia

Formato fixo, 3 segmentos separados por `:` — `escopo:recurso:ação`.

### 1.1 Escopos
| Escopo | Significado |
|---|---|
| `global` | Atravessa todas as empresas/lojas. Master/TI/Admin de plataforma. |
| `tenant` | Restrito à empresa/loja do contexto ativo (`CompanyContext`). |
| `local` | Restrito à(s) loja(s) às quais o usuário está vinculado (`user_empresas`, `proprietario_empresas`, `prospeccao_equipe_membros`). |
| `personal` | Apenas registros de propriedade do próprio usuário (lead criado por ele, agendamento próprio, anotação própria, etc). |

Regra de precedência (de cima para baixo, mais amplo → mais restrito): `global > tenant > local > personal`. Negar em escopo mais amplo não nega o mais restrito automaticamente — cada permissão é avaliada isoladamente; a UI usa `OR` entre escopos quando aplicável.

### 1.2 Recursos
| Tipo | Uso |
|---|---|
| `module` | Controla rota + entrada de menu. Ex.: `tenant:module_prospeccao`. |
| `ui_*` | Elemento de interface granular (aba, botão, coluna, modal). Ex.: `global:ui_controle_acessos_aba_comparar`. |
| `<dominio>` | Recurso de dados/negócio. Ex.: `tenant:usuarios`, `local:leads`, `personal:anotacoes`. |

### 1.3 Ações (verbos atômicos, sem catch-all)
`read`, `create`, `update`, `delete`, `dispatch`, `approve`, `export`, `import`, `assign`, `toggle`, `clone`.

**`manage` é proibido.** Mapeamento direto do registry atual:

| Chave antiga (ad-hoc) | Nova chave (taxonomia) |
|---|---|
| `canManageUsers` | `tenant:usuarios:create`, `tenant:usuarios:update`, `tenant:usuarios:delete` (3 flags) |
| `canAccessControleAcessos` (implícito) | `global:module_controle_acessos:read` |
| `canCreateEventos` | `tenant:eventos_prospeccao:create` |
| `canDispararEventos` | `tenant:eventos_prospeccao:dispatch` |
| `canManageEventos` | expandir em `read/update/delete/dispatch` |
| `canValidarImportacao` | `tenant:import_logs:approve` |
| `canViewProspeccao` | `tenant:module_prospeccao:read` |
| `canReadQRCode` | `tenant:recepcao_visitas:create` (gera leitura) |
| `canAccessAgentesIA` | `global:module_agentes_ia:read` |
| ... (≈120 flags) | tabela completa será gerada no seed da migration |

---

## 2. Schema novo (banco)

### 2.1 `auth_permissions` — catálogo (substitui `PermissionRegistry.ts`)
Colunas:
- `key` text PK — taxonomia (`global:admin_controle_acessos:write`)
- `label` text not null — nome curto p/ UI
- `description` text — o que a permissão faz (legível pelo Admin)
- `module_id` text — agrupador (ex.: `controle_acessos`, `prospeccao`, `recepcao`)
- `has_parameter` boolean default false — substitui `hasValor`
- `parameter_schema` jsonb — JSON Schema (Draft-07) para validar `restriction`. Validação **nativa** via extensão [`pg_jsonschema`](https://github.com/supabase/pg_jsonschema) — a F0 habilita `create extension if not exists pg_jsonschema with schema extensions;` e usa `jsonb_matches_schema(parameter_schema, restriction)` dentro de uma CHECK/trigger leve em `profile_permissions`. Sem loop de validação em PL/pgSQL.
- `created_at` timestamptz default now()

Validação: trigger `BEFORE INSERT/UPDATE` confere que `key` casa com regex `^(global|tenant|local|personal):[a-z0-9_]+:[a-z_]+$`.

### 2.2 `profile_permissions` — overrides por perfil (substitui `departamento_permissoes`)
Colunas:
- `id` uuid PK
- `profile_key` text not null — substitui `departamento` (valores: `Administrador`, `TI`, `Master`, `Vendedor`, `SDR`, ...)
- `permission_key` text not null **REFERENCES `auth_permissions(key)` ON UPDATE CASCADE ON DELETE RESTRICT** — RESTRICT evita drop acidental conforme solicitado
- `is_active` boolean not null default false
- `restriction` jsonb — antigo `valor`, validado contra `auth_permissions.parameter_schema`
- `updated_at` timestamptz default now()
- `updated_by` uuid references `auth.users(id)`
- UNIQUE `(profile_key, permission_key)`
- INDEX `idx_profile_permissions_profile` (`profile_key`)
- INDEX `idx_profile_permissions_permission` (`permission_key`)

### 2.3 `profile_permissions_history` — auditoria
Colunas: `id`, `profile_key`, `permission_key`, `old_is_active` bool, `new_is_active` bool, `old_restriction` jsonb, `new_restriction` jsonb, `changed_by` uuid, `changed_at` timestamptz default now(), `operation` text (`INSERT|UPDATE|DELETE`), **`source` text not null default 'user'** — valores possíveis: `user` (mudança via UI/auth.uid() presente), `service_role` (edge/admin sem `auth.uid()`), `migration` (seed/backfill), `system` (trigger interno, ex.: backfill de wildcard).

Preenchida 100% por trigger `AFTER INSERT OR UPDATE OR DELETE` em `profile_permissions`. `changed_by` lido de `auth.uid()`; quando nulo, a trigger grava `changed_by = NULL` e seta `source = 'service_role'` (ou `'migration'` se a sessão expôs `app.migration = on` via `SET LOCAL`).

### 2.4 RLS
- `auth_permissions`: SELECT para `authenticated`; mutação só `service_role` (catálogo gerenciado por migration/seed).
- `profile_permissions`: SELECT para `authenticated`; INSERT/UPDATE/DELETE somente quando `has_role(auth.uid(), 'Master')` OU permissão `global:admin_controle_acessos:write` resolvida via security definer `has_permission(user_id, key)`.
- `profile_permissions_history`: SELECT apenas para Master/TI/Admin; INSERT só via trigger (revogar de roles diretos).

### 2.5 Função `has_permission(_user uuid, _key text) returns boolean`
SECURITY DEFINER. **Agnóstica a nomes de perfil** — não conhece "Master", "Admin", etc. Resolve em ordem:
1. Lê `profile_key` do `profiles.tipo_acesso` do usuário.
2. Procura `profile_permissions` com `profile_key` igual + `is_active = true` cujo `permission_key` faça match **exato** com `_key`.
3. Caso não exista, procura entradas com `permission_key` contendo wildcard `*` e roda glob matching (ver §3). Superpoderes do Master existem **apenas** porque o seed concede `*:*:*` ao perfil — nenhuma exceção hardcoded.

---

## 3. Wildcard `*` — fim do hardcode `if (tipo === "Master")`

Hoje em `useUserAccessType.ts:67-71` há `if (tipo === "Master") { for (...) resolved[key] = true }`. Vai sumir.

Substituição: seed insere para `profile_key = 'Master'` uma linha:
```
permission_key = '*:*:*'   is_active = true
```
A função `has_permission` e o hook resolvem com matching glob:
- match exato → vence
- senão, procura padrões com `*` em qualquer segmento (`global:*:read`, `*:*:*`, `tenant:usuarios:*`)
- precedência: específico > genérico (peso = nº de segmentos não-`*`)

Validação TS: ajustar `PermissionRegistry.ts` (durante coexistência) e o hook para usar a mesma função de matching glob; remover o `if` Master. Smoke test: Master continua passando todas as rotas/UI.

---

## 4. Proteção contra autolockout

Risco real: um Master/Admin desativar `global:admin_controle_acessos:read` ou `global:admin_controle_acessos:write` do próprio perfil → perde acesso à tela e não consegue voltar.

Estratégia em duas camadas:

**Camada UI** (`ControleAcessos.tsx` → `handleToggle`):
- Antes de chamar `upsert`, simular o novo estado resolvido para `auth.uid()`.
- Se o toggle resultar em perda de `global:admin_controle_acessos:read` OU `global:admin_controle_acessos:write` para o perfil do próprio usuário, abrir `AlertDialog` exigindo confirmação dupla + digitar “CONFIRMO”.
- Lista de permissões críticas configurável (constante TS no início, depois migrada para flag `is_critical` em `auth_permissions`).

**Camada DB** (defesa real):
- Trigger `BEFORE UPDATE/DELETE` em `profile_permissions`:
  - Se `permission_key` está marcada como crítica AND `profile_key = (select tipo_acesso from profiles where id = auth.uid())` AND o resultado deixaria o usuário sem ela → `RAISE EXCEPTION 'autolockout_blocked'`.
- Master ignora a trava apenas se houver pelo menos outro Master ativo (consulta `profiles` + `mfa_master_users`).

---

## 5. Adapter Layer (sem breaking changes)

Princípio: **nada no app quebra durante a migração**. Código atual continua chamando `permissions.canManageUsers`; por baixo, o adapter resolve via nova tabela e cai no antigo `departamento_permissoes` se a nova ainda não tiver entrada.

### 5.1 Mapa legacy → novo
Arquivo `src/lib/rbac/legacyMap.ts`. **Não usa OR ingênuo** — cada chave legacy define explicitamente seu modo de resolução (Mapeamento Direcionado por Contexto), evitando que `canManageUsers` vire `true` só porque o perfil tem `create`.

```ts
type LegacyRule =
  | { mode: 'single'; key: string }                       // 1:1
  | { mode: 'all';    keys: string[] }                    // AND — só true se TODAS forem true
  | { mode: 'any';    keys: string[] }                    // OR  — uso restrito (ex.: "vê o menu")
  | { mode: 'context'; byCaller: Record<string, string> }; // resolve por callsite

export const LEGACY_TO_NEW: Record<string, LegacyRule> = {
  // canManageUsers historicamente gating de criar/editar/excluir → exige TODAS
  canManageUsers: { mode: 'all', keys: [
    'tenant:usuarios:create','tenant:usuarios:update','tenant:usuarios:delete',
  ]},
  // ações granulares devem migrar para chamadas diretas, mas no shim ficam 1:1
  canCreateUsers: { mode: 'single', key: 'tenant:usuarios:create' },
  canEditUsers:   { mode: 'single', key: 'tenant:usuarios:update' },
  canDeleteUsers: { mode: 'single', key: 'tenant:usuarios:delete' },
  // "vê o módulo" pode usar OR explícito
  canAccessControleAcessos: { mode: 'any', keys: ['global:module_controle_acessos:read'] },
  canCreateEventos: { mode: 'single', key: 'tenant:eventos_prospeccao:create' },
  // ... gerado a partir do registry atual
};
```
Regras de resolução:
- `single` → 1:1.
- `all` → AND (default para tudo que era catch-all `manage*`/`canX` de tela com múltiplos botões).
- `any` → OR, **apenas** quando o callsite original já era genuinamente "qualquer uma serve" (ex.: render de menu).
- `context` → quando o mesmo nome legado era usado para coisas diferentes em telas distintas; o hook recebe `caller` e escolhe a chave nova.

Trava de auditoria: durante F1–F3, todo `mode: 'all'` ou `mode: 'any'` loga `[rbac:legacy-resolve] key=<x> mode=<y> result=<bool>` para validar que a substituição direta nos callsites não muda comportamento.

### 5.2 Hook unificado `useRbac()`
Novo hook canônico:
```ts
const { can, canAny, canAll, restriction } = useRbac();
can('tenant:usuarios:create')           // boolean
can('tenant:usuarios:*')                // wildcard ok
restriction('tenant:leads:read')         // jsonb da nova tabela
```

### 5.3 `useUserAccessType` vira shim
Mantém a mesma assinatura pública; internamente:
1. Tenta resolver chave nova correspondente via `LEGACY_TO_NEW` + `useRbac`.
2. Se a permissão nova **não existir ainda em `auth_permissions`**, faz fallback para o cálculo antigo (`resolvePermissions` + `departamento_permissoes`).
3. Loga `console.debug('[rbac:fallback] <legacy_key>')` durante coexistência para inventariar o que ainda falta migrar.

### 5.4 Componentes guard
`PermissionProtectedRoute`, `AdminProtectedRoute`, `TIAdminProtectedRoute`, `GestorProtectedRoute` recebem versão nova `<Can permission="...">` que aceita chaves novas; os antigos viram wrappers que chamam o `<Can>` via `LEGACY_TO_NEW`. Zero arquivo consumidor precisa mudar de uma vez.

### 5.5 Fases de cutover (sem quebrar)
1. **F0** — Migration cria tabelas + seed `auth_permissions` (≈120 chaves) + seed `profile_permissions` espelhando o estado atual de `departamento_permissoes` + flags `*:*:*` para Master.
2. **F1** — Deploy `useRbac` + adapter; `useUserAccessType` segue como shim com fallback ativo.
3. **F2** — Tela `ControleAcessos` passa a ler/escrever em `profile_permissions`. Para coexistência com código legado que ainda lê `departamento_permissoes`, sincronia **unidirecional** `profile_permissions → departamento_permissoes` via trigger `AFTER INSERT/UPDATE/DELETE` na tabela nova. **Sem trigger inversa** (evita loop). A tabela antiga vira projeção read-only: qualquer escrita direta nela é rejeitada por trigger `BEFORE INSERT/UPDATE/DELETE` que faz checagem inteligente — compara `OLD` vs `NEW`; se a linha equivalente em `profile_permissions` já reflete o novo valor (origem foi a sincronia), passa silenciosamente; se for escrita externa genuína, levanta `RAISE EXCEPTION 'departamento_permissoes_is_read_only_use_profile_permissions'`. Esse delta evita reentrância sem precisar de flags de sessão.
4. **F3** — Refactor incremental dos consumidores para chaves novas, removendo entradas do `LEGACY_TO_NEW` à medida que somem do código (grep dirigido pelos logs `[rbac:fallback]`).
5. **F4** — Quando `LEGACY_TO_NEW` ficar vazio e logs zerarem por X dias: drop `departamento_permissoes`, drop `PermissionRegistry.ts`, remover shim.

---

## 6. Governança e auditoria operacional

- Toda mudança fica em `profile_permissions_history` com `changed_by`.
- Tela `ControleAcessos` ganha aba “Histórico” lendo dessa tabela (filtros por perfil, permissão, usuário, intervalo).
- Endpoint/RPC `export_profile_permissions_snapshot()` para baseline versionável.
- Catálogo (`auth_permissions`) só muda via migration — Admin não cria permissão pela UI (evita lixo).

---

## 7. Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Seed inicial divergir do estado real e tirar acesso de alguém | Seed é cópia 1:1 de `departamento_permissoes`; F0 não muda comportamento. |
| Wildcard mal indexado custar performance | `has_permission` cacheia por sessão (memo no hook) + índice em `profile_permissions(profile_key)`. |
| Trigger de autolockout barrar manutenção legítima | RPC `force_unlock_permission` SECURITY DEFINER acessível só a Master via MFA. |

> **Sobre `force_unlock_permission`:** RPC SECURITY DEFINER que reativa uma permissão crítica num `profile_permissions` mesmo quando a trigger de autolockout bloquearia. Regras explícitas: (a) só executa se `auth.uid()` pertencer a `mfa_master_users` E a sessão tiver passado pela verificação TOTP recente (timestamp `mfa_verified_at` < 5 min, gravado pelo fluxo MFA atual); (b) registra em `profile_permissions_history` com `source = 'system'` e um motivo obrigatório (`reason text`); (c) nunca destrava em massa — opera 1 (`profile_key`, `permission_key`) por chamada. Não é "acesso pelo MFA"; é "exige reautenticação MFA do Master para invocar".
| Adapter manter dependência legada indefinidamente | Logs `[rbac:fallback]` + KPI semanal “% chamadas via fallback” no plano. |
| `eventos_prospeccao`/`bulk_upsert_contatos` afetados por mudança de RLS | Esta fase **não toca RLS de dados**; só substitui catálogo/overrides de permissão. RLS de tabelas críticas migra em fase própria. |

---

## 8. Entrega desta etapa

- Salvar este plano como `/mnt/documents/plano-rbac-fine-grained.md` (será feito ao entrar em build mode).
- Nenhuma migration, nenhum código, nenhum drop nessa rodada.
- Após sua aprovação: próxima etapa é a migration F0 (auth_permissions + profile_permissions + history + trigger + seed espelho).
