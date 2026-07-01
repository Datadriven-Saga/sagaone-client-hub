# Inventariado — RBAC Fine-Grained (varreduras item 8)

> **Escopo:** este documento fecha o item 8 do plano (`docs/plano-rbac-fine-grained.md`) e da `docs/previsao-breaking-changes.md`. É o resultado bruto, **comentado**, das varreduras `rg` que precedem F0. Serve como input direto para:
>
> 1. construção do mapa `LEGACY_TO_NEW` no adapter (F0);
> 2. decisão sobre **drop** vs **migração** de cada flag;
> 3. checklist de revisão dos guards (`AdminProtectedRoute`, `TIAdminProtectedRoute`, `PermissionProtectedRoute`);
> 4. cálculo do baseline para telemetria `[rbac:fallback]` / `[rbac:bypass-ti hit]`.
>
> **Snapshot:** rodado a partir de `main` (Sun 14 Jun 2026). Reexecutar antes de abrir o PR de F0 — qualquer item novo entra como entrada adicional.

---

## 0. Comandos executados (reprodutível)

```bash
# Inventário do nome da tabela legada (banco + código)
rg -n "departamento_permissoes" supabase/
rg -n "departamento_permissoes" src/
rg -n "departamento_permissoes" deploy/ scripts/

# Inventário de chaves legadas no front
rg --glob '*.ts' --glob '*.tsx' "can[A-Z][A-Za-z0-9_]+" src/ -oNI | sort -u

# Inventário de bypasses por código (role-based shortcuts)
rg -n "isDepartamentoTI" src/
rg -n "isMaster|isAdmin|isTI|isDiretor|isGerente|isVendedor|isSDR" src/

# Helpers existentes (que vão precisar de shim)
rg -n "getPermissionValor|resolvePermissions" src/

# Coluna `valor` (será renomeada para `restriction` em F1)
rg -n "\.valor\b" src/pages/admin/ControleAcessos.tsx \
                 src/hooks/useUserAccessType.ts \
                 src/components/controle-acessos/

# Guards de rota
rg -n "AdminProtectedRoute|TIAdminProtectedRoute|GestorProtectedRoute|PermissionProtectedRoute" src/
```

---

## 1. `departamento_permissoes` — superfície real

### 1.1 Banco (migrations)
9 migrations tocam a tabela:

| Migration | O que faz | Ação no plano |
|---|---|---|
| `20260209121518_…` | `CREATE TABLE` + RLS inicial (admin-only) | Manter; vira **read-only** em F1 |
| `20260212171615_…` | Substitui policy por `admin/master/ti` | Substituído em F3 por `has_permission('global:admin_controle_acessos:write')` |
| `20260219175132_…` | `DELETE` da chave `canUploadBase` | Histórico, não migrar |
| `20260219175818_…` | `DELETE` da chave `canImportClientes` | Histórico, não migrar |
| `20260409134016_…` | **Seed** com defaults do `PermissionRegistry` | Substituído pelo seed novo em `auth_permissions` (F0) |
| `20260505133315_…` | Adiciona coluna `valor jsonb` (sem schema) | Renomeada para `restriction` + validação `pg_jsonschema` (BC-10) |
| `20260505210318_…` | Seed das duas chaves de pool | Migra para `tenant:contatos_pool:read` |
| `20260516144757_…` | `UPDATE` + `INSERT` em lote | Histórico |
| `20260608205458_…` | Policy split (`select_authenticated` + `write_admin_master_ti`) | Em F3, `select_authenticated` é mantida; `write` vira trigger reject |

**Conclusão A:** nenhuma migration usa a tabela como side-effect de domínio (audit/log/etc). A descontinuação é segura para read-only via trigger (BC-08).

### 1.2 Edge functions

```text
rg -n "departamento_permissoes" supabase/functions/   →  (vazio)
```

**Conclusão B:** nenhuma edge function escreve direto. **BC-09 (write rejeitado) não tem callsite oculto**. O adapter não precisa cobrir edge.

### 1.3 Frontend (consumidores diretos)

| Arquivo | Operação | Tratamento em F0/F1 |
|---|---|---|
| `src/hooks/useUserAccessType.ts:40` | `select` de todas linhas (no boot) | Mantido; em F2 passa a ler de `v_user_effective_permissions` (view sobre `profile_permissions`). Linha do `select` antigo fica via shim com fallback. |
| `src/pages/admin/ControleAcessos.tsx:34,78,108,148` | `select`/`upsert` (toggle, valor, clone) | Refactor obrigatório em F1: UI passa a falar com `profile_permissions` via RPC. Esta página é o **único writer** que sobra. |
| `src/integrations/supabase/types.ts:1745` | Tipo gerado | Regenerar após F1 (mantém ambas as tabelas durante coexistência). |
| `src/components/PermissionProtectedRoute.tsx` | comentário | Atualizar doc-string em F2. |
| `src/components/controle-acessos/PermissionRegistry.ts:314` | comentário | Atualizar doc-string em F1. |

**Conclusão C:** writer único = `ControleAcessos.tsx`. O resto é leitor. O refactor de F1 fica **localizado**, não espalhado.

---

## 2. Chaves legadas (`can*`) — universo total e gaps

### 2.1 Volumetria

| Métrica | Valor |
|---|---|
| Chaves declaradas em `PermissionRegistry` | **120** |
| Chaves únicas referenciadas em callsites (fora do Registry e do hook) | **91** (filtrando ruído) |
| Callsites totais (ocorrências) | **408** |
| **Órfãs** (em Registry, sem callsite real) | **63** |
| **Fantasmas** (em callsite, sem Registry) | **20** (10 reais + 10 ruído `canScroll*`, `canSubmit`, `canBeActive`) |

### 2.2 ÓRFÃS — 63 chaves a deprecar

Estas chaves existem no Registry e portanto **aparecem no UI de Controle de Acessos** como toggle clicável, mas **nenhum componente as consulta**. São o "código inerte" do item 8.

Decisão no plano (§5.1 do `plano-rbac-fine-grained.md`):

- **Não migrar** para o novo catálogo em F0.
- F1 marca cada uma como `deprecated_at = now()` no Registry (não remove ainda, evita quebrar Comparar/Por Perfil).
- F4 remove do Registry e da tabela velha.

Lista completa (input direto para o seed de "deprecation" em F1):

```text
canAccessKanban
canAprovarCampanhas
canCreateAgentesIA
canCreateControleAgentes
canCreateGatilhos
canCreatePersonas
canCreateProspeccao
canCreateTemplates
canCreateVendas
canDeleteAgentesIA
canDeleteAtendimentos
canDeleteClientes
canDeleteControleAgentes
canDeleteGatilhos
canDeletePersonas
canDeleteProspeccao
canDeleteTemplates
canDeleteVendas
canEditAgentesIA
canEditAtendimentos
canEditClientes
canEditConfiguracoes
canEditContatos
canEditControleAgentes
canEditEmpresas
canEditGatilhos
canEditPersonas
canEditProspeccao
canEditTemplates
canEditVariaveis
canEditVendas
canExportRelatorios
canGenerateInvites
canImportClientes
canManageAPIs
canManageCadencias
canManageDepartamentos
canManageDocumentos
canManageEvents              ← (typo de canManageEventos; remover)
canManageFollowups
canManageIntegracoes
canManageMensagens
canManageMotivos
canManageOrigens
canManagePosVendasCadencia
canManagePosVendasLojas
canManagePosVendasTemplates
canManageProdutos
canManageProspeccaoEquipes
canManageTemperaturas
canManageWebhooks
canManageWhatsApp
canProgramarCampanhas
canReadQRCode
canSyncResultados
canToggleControleAgentes
canValidarImportacao
canViewDashboard
canViewEmpresas
canViewEventos
canViewIALigacaoLogs
canViewMetricas
canViewVariaveis
```

**Atenção — falsos órfãos a auditar à mão antes de remover:**

- `canManageEvents` é alias provavelmente acidental de `canManageEventos` (callsite real: `canManageEventos`). Confirmar e dropar.
- `canManageProspeccaoEquipes` aparece zero vezes em callsite direto, mas a memória `prospeccao-teams-access` referencia como gate. **Verificar manualmente** antes de marcar deprecated — pode estar mascarada por destruturação dinâmica (`permissions[key]`).
- `canManagePosVendasLojas`, `canManagePosVendasCadencia`, `canManagePosVendasTemplates` — pode haver acesso via prop drilling não-string. Validar via referências LSP em F0.

### 2.3 FANTASMAS — 10 chaves consultadas sem definição

Após filtrar ruído de shadcn (`canScrollNext`, `canScrollPrev`, `canSubmit`, `canBeActive`, `canSuccess`, `canLine`, `canComplete`) e fragmentos genéricos:

| Chave | Onde aparece | Causa | Ação |
|---|---|---|---|
| `canDispatchLigacao` | `EventoBase.tsx` x2 | Inline ad-hoc | Mapear → `tenant:eventos_prospeccao:dispatch` (filtro por canal=ligação) |
| `canDispatchWhatsApp` | `EventoBase.tsx` x2 | Inline ad-hoc | Mapear → `tenant:eventos_prospeccao:dispatch` (canal=whatsapp) |
| `canManageMasters` | `admin/Acessos.tsx` x2 | Não está no Registry | Mapear → `global:mfa_master:manage` |
| `canSeeAdministracao` | múltiplos | Alias informal de `canAccessAdministracao` | Mapear no `LEGACY_TO_NEW` (mode:`single`) |
| `canSeeAgentesIA` | múltiplos | Alias informal de `canAccessAgentesIA` | Mapear no `LEGACY_TO_NEW` |
| `canSeeAlgCompra` / `canSeeAlgVenda` / `canSeeAlgPosVendas` / `canSeeAlgoritmos` | sidebar/menus | Aliases informais | Mapear todos para `canAccessAlgoritmos*` correspondentes |
| `canSeeAllEventos` | `Prospeccao.tsx` | Lógica derivada (não vinda do Registry) | **Auditar:** se for derivado de role (Master/Diretor), vira `tenant:eventos_prospeccao:read` com escopo `tenant` sem filtro por owner |
| `canSeeCadeiras` / `canSeeClientes` / `canSeeConfiguracoes` / `canSeePosVendas` / `canSeeRelatorios` / `canSeeResultados` | sidebar | Aliases informais de `canAccess*` | Bulk mapping no `LEGACY_TO_NEW` |

**Conclusão D:** os fantasmas são, em maioria, **aliases inconsistentes de `canSee*` vs `canAccess*`** — sintoma claro de chave ad-hoc que a taxonomia nova elimina. O adapter precisa de **uma única regra de alias** (`canSeeX → canAccessX`) e ponto.

---

## 3. Bypasses por código (alvo principal do plano)

### 3.1 `isDepartamentoTI`

```text
src/hooks/useUserAccessType.ts:110   const isDepartamentoTI = (departamento ?? "").trim().toUpperCase() === "TI";
src/hooks/useUserAccessType.ts:138   canAccessAgentesIA: p("canAccessAgentesIA") || (isDepartamentoTI && isAdminOrTI);
src/pages/admin/Agentes.tsx:213      const canAccess = isDepartamentoTI && isAdminOrTI;
```

- **Mapeamento BC-05:** seed `global:module_agentes_ia:read=true` para os perfis afetados em F0.
- **F2:** linha 138 some; hook passa a chamar apenas `p("global:module_agentes_ia:read")`.
- **F2:** linha 213 vira `<Can perm="global:module_agentes_ia:read">`.
- **Telemetria F0–F2:** `[rbac:bypass-ti hit]` incrementa quando `isDepartamentoTI && isAdminOrTI && !p("canAccessAgentesIA")` (qualquer disparo prova que seed está incompleto).

### 3.2 Role flags como gate

`isMaster|isAdmin|isTI|isDiretor|isGerente|isVendedor|isSDR` aparecem em **23 arquivos**. Categorizando:

| Categoria | Arquivos | Tratamento |
|---|---|---|
| Hook (definição) | `useUserAccessType.ts`, `useAdminCheck.ts`, `useMfaMaster.ts` | Manter. Continuam expondo a flag para o adapter; deixam de ser **fonte** de decisão. |
| Guards de rota | `AdminProtectedRoute.tsx`, `GestorProtectedRoute.tsx`, `PermissionProtectedRoute.tsx` | **BC-06:** `AdminProtectedRoute` vira `<Can perm="global:admin_dashboard:read">`. `GestorProtectedRoute` vira `<Can perm="tenant:gestao:read">`. |
| Páginas admin (gate UI) | `admin/Acessos.tsx`, `admin/Empresas.tsx`, `admin/Quarentena.tsx`, `admin/LogsCadeiras.tsx`, `admin/MFAMasterDashboard.tsx`, `admin/ControleAcessos.tsx`, `Administracao.tsx`, `Cadeiras.tsx` | F2: substituir `if (!isAdmin && !isTI)` por `if (!can('global:<recurso>:read'))`. |
| Domínio (lógica de negócio) | `Prospeccao.tsx`, `NovoLeadModal.tsx`, `useAutoAtribuirLeads.ts`, `useQuarentenaData.ts` | **Cuidado.** Role aqui pode ser regra de domínio (ex.: SDR só vê próprios leads). Validar caso a caso — algumas viram `local:*:read`/`personal:*:read`, outras permanecem como dado para a UI. |
| MFA | `admin/MFAMasterDashboard.tsx`, `admin/MFAGeral.tsx`, `MFAPasswordVaultTab.tsx`, `MFAAgentesContent.tsx`, `useMfaMaster.ts` | Inalterado por enquanto. MFA já é "fator extra" e independe da taxonomia. BC-18 (`force_unlock_permission`) é o único toque. |

**Conclusão E:** das 52 ocorrências de `isMaster` no código não-MFA, **a maioria** está em guards/páginas admin e é mapeável 1:1. Restam ~5–8 ocorrências em domínio (Prospecção/Quarentena) que exigem **decisão de produto** sobre escopo (`tenant` vs `local` vs `personal`).

---

## 4. Helpers que viram shim

| Helper hoje | Onde | Shim em F0 |
|---|---|---|
| `useUserAccessType()` | `src/hooks/useUserAccessType.ts` | Mantém assinatura. Internamente: lê `auth_permissions` novo, recai para tabela velha se chave não encontrada, loga `[rbac:fallback]`. |
| `getPermissionValor(key)` | `useUserAccessType.ts:114`, consumido em `ImportarDoDataLake.tsx:296` | Renomeado para `restriction(key)` em F2; shim mantém `getPermissionValor` como wrapper. |
| `resolvePermissions(tipo, overrides)` | `PermissionRegistry.ts:532`, usado em `ControleAcessos.tsx` e no próprio hook | F1: nova implementação consulta `profile_permissions`; assinatura preservada. |
| `PERMISSION_REGISTRY` / `TIPOS_ACESSO` | `PermissionRegistry.ts` | F1: gerado dinamicamente da view `v_permission_catalog`; consumidores não mudam. |
| Coluna `valor jsonb` | `departamento_permissoes` | F1: renomeada para `restriction`, valida via `jsonb_matches_schema` (BC-10). Shim no select normaliza ambos os nomes. |

---

## 5. Guards de rota

- **`PermissionProtectedRoute`** já existe e cobre a maioria das rotas de `App.tsx`. Não muda em F0; em F2 trocamos o lookup `permissions[key]` por `can(newKey)` com fallback.
- **`AdminProtectedRoute`** ainda usa `isAdmin` direto (BC-06). Refactor em F2.
- **`TIAdminProtectedRoute`** mesmo padrão de BC-06.
- **`GestorProtectedRoute`** idem.

**Ação F0:** criar componente novo `<Can perm="...">` e `<Route element={<Can ... />}/>` mantendo os 4 guards atuais como wrappers do `<Can>` (zero quebra).

---

## 6. Resumo executivo (entrega item 8)

| Pergunta | Resposta |
|---|---|
| Quantas chaves o adapter precisa mapear? | **57** chaves "vivas" (120 do Registry − 63 órfãs) + **10** aliases fantasmas reais |
| Existe writer escondido em edge? | **Não** (varredura limpa em `supabase/functions/`) |
| Quantos arquivos escrevem em `departamento_permissoes`? | **1** (`pages/admin/ControleAcessos.tsx`) |
| Quantos bypasses por código? | **1** documentado (`isDepartamentoTI` em `canAccessAgentesIA`) + uso difuso de `isMaster`/`isAdmin` em ~23 arquivos |
| Risco de quebra silenciosa em F2 | **Médio** — concentrado em domínio Prospeccao/Quarentena (item §3.2 categoria "Domínio"). Mitigação: telemetria `[rbac:fallback]` por chave + dashboard antes de qualquer drop |
| Algum item fora do escopo do adapter? | **Sim** — escopo `local`/`personal` (regras de SDR ver só próprios leads) precisa de mudança real na consulta, não dá para esconder no shim |

---

## 7. Próximos passos (handoff para F0)

1. Validar com o time se `canManageProspeccaoEquipes`, `canManagePosVendas*` realmente são órfãs (LSP `references`).
2. Decidir mapeamento `canSeeAllEventos` (role-derived) — única chave fantasma que não é alias trivial.
3. Congelar a lista de **57 chaves vivas** acima como input do `LEGACY_TO_NEW` v1.
4. Reexecutar todas as varreduras imediatamente antes do PR de F0 e anexar diff a este documento.
