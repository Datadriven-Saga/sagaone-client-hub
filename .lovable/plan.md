
# Plano: Documento `previsao-breaking-changes.md`

Criar um documento descritivo (sem código, sem migration) listando as quebras de comportamento previsíveis ao migrar de `PermissionRegistry.ts` + `departamento_permissoes` → `auth_permissions` + `profile_permissions` com a taxonomia `escopo:recurso:ação`, e mapear cada uma ao mecanismo do adapter (`LEGACY_TO_NEW` + `useUserAccessType` shim + sincronia unidirecional) responsável por absorvê-la.

## Localização

- `docs/previsao-breaking-changes.md` (versionado no repo)
- `/mnt/documents/previsao-breaking-changes.md` (cópia entregável)

## Fontes cruzadas

- `.lovable/plan.md` (plano RBAC fine-grained — §5 adapter, §3 wildcard, §4 autolockout, §5.5 fases de cutover)
- `docs/controle-acessos-auxiliar-detalhado.md` (§3.1–§3.13 inconsistências, §6.1–§6.10 hardcodes, §7.2 tradução flag→taxonomia)
- `src/hooks/useUserAccessType.ts` (force-true Master, bypass TI, ~50 flags nomeadas)
- Guards de rota (`AdminProtectedRoute`, `TIAdminProtectedRoute`, `GestorProtectedRoute`, `PermissionProtectedRoute`)

## Estrutura do documento

### 1. Objetivo e escopo
Listar quebras esperadas + para cada uma: gatilho, raiz, sintoma observável, callsites afetados, **mecanismo do adapter** que neutraliza, **sinal de monitoramento** (`[rbac:fallback]`, `[rbac:legacy-resolve]`) e **critério de saída** (quando podemos deletar a regra do adapter).

### 2. Categorias de breaking changes
Agrupadas para o leitor entender o "tipo" de risco:

- **BC-A — Semântica de chave legada** (catch-all `manage*` vira AND/OR explícito)
- **BC-B — Bypass implícito virando flag** (depto TI, force-true Master)
- **BC-C — Superfícies duplicadas** (`p("key")` vs flag nomeada vs guard dedicado)
- **BC-D — Resolução por escopo** (`global` único → `global|tenant|local|personal`)
- **BC-E — Validação de `valor jsonb`** (front-only → `pg_jsonschema` server-side)
- **BC-F — Autolockout** (toggle livre → trigger DB + confirmação UI)
- **BC-G — Sincronia de tabelas** (`profile_permissions` ↔ `departamento_permissoes` read-only)
- **BC-H — Auditoria e RLS** (RLS de `departamento_permissoes` por string fixa → `has_permission`)
- **BC-I — Wildcard e precedência** (Master deixa de ser force-true client)
- **BC-J — Realtime / cache** (mudança no banco propagando para clientes ativos)

### 3. Lista estruturada (uma entrada por BC)

Cada item segue o template fixo:

```
### BC-XX — <título curto>
- Gatilho: <quando ocorre>
- Raiz no código atual: <arquivo:linha + snippet>
- Sintoma sem adapter: <o que quebraria visivelmente>
- Callsites em risco: <componentes/rotas/RPCs>
- Cobertura do adapter:
  - Regra LEGACY_TO_NEW: <mode + keys>
  - Shim useUserAccessType: <comportamento>
  - Guard wrapper: <Can/PermissionProtectedRoute>
  - Sincronia DB: <trigger envolvida, se aplicável>
- Sinal de monitoramento: <log/KPI>
- Critério de saída (drop da regra): <condição mensurável>
- Risco residual: <o que o adapter NÃO cobre>
```

Entradas planejadas (≈18, derivadas direto do auxiliar):

| Cód.   | Título                                                                          | Origem (auxiliar/plan)        |
| ------ | ------------------------------------------------------------------------------- | ----------------------------- |
| BC-01  | `canManageUsers` deixa de ser OR ingênuo (vira AND `create+update+delete`)     | plan §5.1; aux §6.5           |
| BC-02  | `canManageEventos` expandido em `read/update/delete/dispatch`                   | plan §1.3; aux §7.2           |
| BC-03  | `canManageInstancias`, `canManageCadencias` perdem catch-all                    | aux §7.2                      |
| BC-04  | Force-true Master removido; passa a depender de seed `*:*:*`                    | aux §3.1, §6.1; plan §3        |
| BC-05  | Bypass `isDepartamentoTI` em `canAccessAgentesIA` removido                      | aux §3.3, §6.2                |
| BC-06  | `AdminProtectedRoute`/`TIAdminProtectedRoute` passam por `<Can>`                | aux §6.3                      |
| BC-07  | `canAccessControleAcessos` ganha trava de autolockout (UI + DB)                 | aux §3.4; plan §4              |
| BC-08  | `departamento_permissoes` vira read-only via trigger                            | plan §5.5                     |
| BC-09  | Escritas diretas no SQL antigo passam a falhar com erro nomeado                 | plan §5.5                     |
| BC-10  | `valor jsonb` rejeitado se não casar com `parameter_schema` (`pg_jsonschema`)   | plan §2.1; aux §3.10, §6.8    |
| BC-11  | `getPermissionValor` substituído por `restriction()` (mesma assinatura no shim) | plan §5.2; aux §3.10          |
| BC-12  | RLS de `departamento_permissoes` deixa de gatear por string `tipo_acesso`       | aux §6.4                      |
| BC-13  | Wildcard `*:*:*` exige glob matching consistente client+server                  | plan §3                       |
| BC-14  | `useUserAccessType` mantém assinatura mas internamente vira shim → fallback log | plan §5.3                     |
| BC-15  | Flags órfãs (`canManageWebhooks` etc.) deixam de aparecer no novo catálogo     | aux §3.2, §3.13               |
| BC-16  | Contadores "X/120 ativas" mudam de base (novo catálogo, sem órfãs)              | aux §3.13                     |
| BC-17  | Auditoria preenchida por trigger; `changed_by` nulo para service_role           | plan §2.3                     |
| BC-18  | `force_unlock_permission` exige MFA recente (Master sem TOTP é bloqueado)       | plan §7                       |

### 4. Não-quebras (o que o adapter **garante** que não muda)
Lista curta para reduzir ansiedade do revisor: assinatura de `useUserAccessType`, props de `PermissionProtectedRoute`, comportamento de rotas durante F1–F3, leitura de `departamento_permissoes` por código legado (via sincronia unidirecional), defaults visíveis em "Por Perfil" (seed espelha estado atual).

### 5. Matriz de cobertura
Tabela final cruzando cada BC com a fase (F0/F1/F2/F3/F4) em que ela é introduzida e a fase em que pode ser removida do adapter. Permite ao revisor planejar janelas de observação.

### 6. Limites do adapter
Itens que o adapter **não** cobre e que exigem refactor manual nos callsites antes de F4:
- Introdução de escopo `tenant`/`local`/`personal` (BC-D): legacy é sempre `global`; novo callsite precisa decidir escopo.
- Ownership (`personal`) em `canDelete*`: o shim não sabe quem é o dono do registro.
- Multi-tenant em `canManageUsers`: shim resolve global, mas a regra correta exige `tenant`.

### 7. Riscos residuais e telemetria
KPIs propostos: `% chamadas via [rbac:fallback]` por semana; contagem por chave; alarme quando `mode:'all'` ou `'any'` mudar resultado vs baseline pré-F1 (smoke diff).

---

**Entrega desta etapa:** apenas o `.md` em `docs/` + `/mnt/documents/`. Nenhuma alteração de código, migration ou drop.
