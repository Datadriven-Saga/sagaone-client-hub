# Previsão de Breaking Changes — Migração RBAC `escopo:recurso:ação`

> Documento complementar de `.lovable/plan.md` (Plano RBAC Fine-Grained) e [`docs/administracao/controle-acessos-auxiliar-detalhado.md`](../administracao/controle-acessos-auxiliar-detalhado.md). **Escopo:** catalogar, em formato estruturado, **toda mudança de comportamento previsível** que ocorrerá ao migrar de `PermissionRegistry.ts` + `departamento_permissoes` para `auth_permissions` + `profile_permissions` (taxonomia `escopo:recurso:ação`), e mapear, para cada uma, **qual mecanismo do adapter** absorve a quebra, **qual sinal de monitoramento** prova que está sendo absorvida, e **qual critério de saída** autoriza remover a regra do adapter.
>
> **Fora de escopo:** propor migration, escrever código, decidir cronograma final. Este documento é entrada para a revisão antes de F0.

---

## 1. Como ler este documento

Cada item da §3 segue o template fixo:

```
### BC-XX — <título curto>
- Gatilho: quando a quebra é exposta (qual fase, qual ação do usuário).
- Raiz no código atual: arquivo:linha + snippet de referência.
- Sintoma sem adapter: o que o usuário/sistema veria se o adapter não existisse.
- Callsites em risco: componentes, rotas, hooks, RPCs impactados.
- Cobertura do adapter:
  • Regra LEGACY_TO_NEW (mode + keys).
  • Comportamento do shim `useUserAccessType` / `useRbac`.
  • Wrapper de guard envolvido.
  • Trigger/sincronia DB (quando aplicável).
- Sinal de monitoramento: log estruturado e/ou KPI que comprova a absorção.
- Critério de saída: condição mensurável que autoriza dropar a regra do adapter.
- Risco residual: o que o adapter explicitamente NÃO cobre.
```

Convenções:

- Logs do adapter sempre seguem o prefixo `[rbac:…]` para grep dirigido.
- "Pré-F1" = comportamento atual. "F1+" = comportamento após adapter ativo. "F4" = adapter removido.

---

## 2. Categorias

Agrupamento para o revisor entender o **tipo** de risco antes de descer ao detalhe:

| Categoria | Tema | Itens |
| --- | --- | --- |
| **BC-A** | Semântica de chave legada (catch-all `manage*` → AND/OR explícito) | BC-01, BC-02, BC-03 |
| **BC-B** | Bypass implícito virando flag de dado | BC-04, BC-05 |
| **BC-C** | Superfícies duplicadas (`p("key")` × flag nomeada × guard dedicado) | BC-06, BC-14 |
| **BC-D** | Resolução por escopo (`global` único → `global\|tenant\|local\|personal`) | BC-D listado em §6 (limites do adapter) |
| **BC-E** | Validação de `valor jsonb` (front-only → `pg_jsonschema` server-side) | BC-10, BC-11 |
| **BC-F** | Autolockout (toggle livre → trigger DB + confirmação UI) | BC-07, BC-18 |
| **BC-G** | Sincronia de tabelas (`profile_permissions` → `departamento_permissoes` read-only) | BC-08, BC-09 |
| **BC-H** | Auditoria e RLS (RLS por string fixa → `has_permission`) | BC-12, BC-17 |
| **BC-I** | Wildcard e precedência (Master deixa de ser force-true client) | BC-04, BC-13 |
| **BC-J** | Catálogo de permissões muda de base | BC-15, BC-16 |

---

## 3. Lista estruturada de breaking changes

### BC-01 — `canManageUsers` deixa de ser OR ingênuo (vira AND `create+update+delete`)
- **Gatilho:** F1 — primeira leitura via shim para perfis que tinham `canManageUsers=true` mas só uma das 3 ações granulares ativa.
- **Raiz no código atual:** `PermissionRegistry.ts:316-502` (`getDefaultPermissions`) — `canManageUsers` resolvido por OR sobre identidade de perfil; `useUserAccessType.ts:p("canManageUsers")`.
- **Sintoma sem adapter:** perfil com `tenant:usuarios:create=true` mas sem `update/delete` veria `canManageUsers=true` pelo OR antigo e `false` pelo AND novo → botões de edição/exclusão sumindo silenciosamente.
- **Callsites em risco:** `src/components/admin/GestaoUsuariosTab`, `src/pages/admin/Acessos.tsx`, qualquer leitura de `permissions.canManageUsers`.
- **Cobertura do adapter:**
  - `LEGACY_TO_NEW`: `{ mode: 'all', keys: ['tenant:usuarios:create','tenant:usuarios:update','tenant:usuarios:delete'] }`.
  - Shim retorna `true` somente quando as três novas estão ativas; caso contrário cai no antigo `resolvePermissions` e loga divergência.
  - Guard wrapper: nenhum — chave usada inline em componentes.
- **Sinal de monitoramento:** `[rbac:legacy-resolve] key=canManageUsers mode=all result=<bool> diffFromLegacy=<bool>`. KPI: contagem de `diffFromLegacy=true` por perfil/semana.
- **Critério de saída:** zero callsites usando `canManageUsers` por 14 dias (grep dirigido por `[rbac:fallback]`).
- **Risco residual:** AND mais restritivo pode esconder ações que antes apareciam por engano; necessário review manual dos perfis Gerente* antes do F1.

### BC-02 — `canManageEventos` expandido em `read/update/delete/dispatch`
- **Gatilho:** F1, telas de prospecção que dependem do catch-all.
- **Raiz:** `PermissionRegistry.ts` (entrada `canManageEventos`); `useUserAccessType.ts` flag homônima; `src/components/admin/EventosLigacaoTab.tsx`, `src/pages/admin/ControleAgentes.tsx`.
- **Sintoma sem adapter:** botões de "Disparar" e "Excluir evento" perderiam visibilidade para perfis cuja flag antiga era `true` mas que não receberam todas as 4 chaves novas no seed.
- **Callsites em risco:** todo consumidor de `canManageEventos` + `canEditEventos` + `canDeleteEventos` + `canDispararEventos`.
- **Cobertura do adapter:** `{ mode: 'all', keys: ['tenant:eventos_prospeccao:read','tenant:eventos_prospeccao:update','tenant:eventos_prospeccao:delete','tenant:eventos_prospeccao:dispatch'] }`. Seed F0 garante paridade.
- **Sinal:** `[rbac:legacy-resolve] key=canManageEventos`.
- **Critério de saída:** consumidores migrados para chave granular específica do botão (não para o catch-all).
- **Risco residual:** `dispatch` é regulatório/custo — recomendar split em PR separado.

### BC-03 — `canManageInstancias`, `canManageCadencias`, `canManageEvents` perdem catch-all
- **Gatilho:** F1, módulos Agentes IA / Cadências / Eventos legados.
- **Raiz:** múltiplas entradas `canManage*` em `PermissionRegistry.ts`, com defaults por perfil em `getDefaultPermissions`.
- **Sintoma sem adapter:** comportamento idêntico ao BC-02 em escopos diferentes.
- **Callsites em risco:** `src/components/AgenteInstancias.tsx`, `src/components/AgenteCadencias*.tsx`, `src/components/CadenciaModal.tsx`.
- **Cobertura:** `mode: 'all'` espelhando as ações granulares correspondentes (`read/create/update/delete[/toggle]`).
- **Sinal:** `[rbac:legacy-resolve] key=canManage<X>`.
- **Critério de saída:** mesmo padrão BC-02.
- **Risco residual:** `toggle` (liga/desliga agente) pode não existir como ação granular em todas as entradas — auditar no seed.

### BC-04 — Force-true Master removido; passa a depender de seed `*:*:*`
- **Gatilho:** F1, qualquer ação de usuário Master.
- **Raiz:** `src/hooks/useUserAccessType.ts:67-71` (`if (tipo === "Master") { for (...) resolved[key] = true }`).
- **Sintoma sem adapter:** Master perderia acesso a tudo que não estivesse explicitamente listado no novo catálogo.
- **Callsites em risco:** todo o app — Master atravessa quase toda rota.
- **Cobertura:**
  - Seed F0: `INSERT (profile_key='Master', permission_key='*:*:*', is_active=true)`.
  - `has_permission` / `useRbac` aplicam glob matching (`*:*:*` vence tudo que não tenha negação explícita).
  - Smoke test obrigatório no PR de F1: Master percorre todas as rotas guardadas.
- **Sinal:** `[rbac:master-wildcard hit key=<x>]` em modo verbose durante 7 dias; alerta se Master receber `false` em qualquer `has_permission`.
- **Critério de saída:** o `if` físico já é removido em F1; o **monitoramento** pode sair em F2 após 0 alertas por 14 dias.
- **Risco residual:** wildcards mal indexados podem perder para específicos com `is_active=false` se a precedência (peso = nº de segmentos não-`*`) não estiver implementada client+server identicamente — ver BC-13.

### BC-05 — Bypass `isDepartamentoTI` em `canAccessAgentesIA` removido
- **Gatilho:** F1, usuários com `profiles.departamento='TI'` mas perfil não-TI.
- **Raiz:** `src/hooks/useUserAccessType.ts:138` — `canAccessAgentesIA: p("canAccessAgentesIA") || (isDepartamentoTI && isAdminOrTI)` + `TIAdminProtectedRoute.tsx`.
- **Sintoma sem adapter:** usuários que entravam pelo bypass perderiam acesso ao módulo de Agentes IA sem aviso.
- **Callsites em risco:** `App.tsx` rota `/agentes-ia/*`, `TIAdminProtectedRoute`, `AppSidebar`.
- **Cobertura:**
  - Seed F0 levanta inventário de usuários que **só** acessavam via bypass; cria flag `global:module_agentes_ia:read=true` explícita para os perfis afetados (decisão registrada em §6 do plano).
  - Shim mantém o OR durante F1 mas loga `[rbac:bypass-ti hit user=<id>]` cada vez que o bypass é o que concede acesso.
- **Sinal:** `[rbac:bypass-ti hit]`.
- **Critério de saída:** 0 hits do log por 14 dias → remover o OR do shim em F2.
- **Risco residual:** se a contagem persistir > 0, é sinal de que o seed F0 não capturou todos os casos — exige revisão antes do drop.

### BC-06 — `AdminProtectedRoute` / `TIAdminProtectedRoute` / `GestorProtectedRoute` passam por `<Can>`
- **Gatilho:** F1, qualquer navegação que atravesse esses guards.
- **Raiz:** três guards paralelos (`src/components/AdminProtectedRoute.tsx`, `TIAdminProtectedRoute.tsx`, `GestorProtectedRoute.tsx`) que leem `tipo_acesso` direto ou flag derivada — fora do fluxo de `PermissionProtectedRoute`.
- **Sintoma sem adapter:** divergência: alterar permissão pela UI não afeta rotas guardadas por esses três componentes; em F2 (quando UI escreve em `profile_permissions`), o efeito sumiria nas rotas administrativas.
- **Callsites em risco:** `App.tsx` (≈60 rotas).
- **Cobertura:** os três guards viram wrappers finos sobre `<Can permission="…">`. Lista de permissões equivalentes:
  - `AdminProtectedRoute` → `global:module_administracao:read`
  - `TIAdminProtectedRoute` → `global:module_agentes_ia:read`
  - `GestorProtectedRoute` → `tenant:module_administracao:read` (qualquer um dos perfis de gestão).
- **Sinal:** `[rbac:guard-shim name=<X> user=<id> allowed=<bool>]`.
- **Critério de saída:** PRs incrementais substituindo os três guards por `<Can>` direto; quando os arquivos sumirem, sinal removido.
- **Risco residual:** `isAdmin = (tipo_acesso ∈ {Administrador,Master})` é avaliado **dentro do guard hoje**; o wrapper precisa preservar a mesma semântica para Master via wildcard (BC-04).

### BC-07 — `canAccessControleAcessos` ganha trava de autolockout (UI + DB)
- **Gatilho:** F2 — admin/master tenta desligar a permissão do próprio perfil.
- **Raiz:** `ControleAcessos.tsx:handleToggle` faz `upsert` sem checagem; `App.tsx:169` guarda a rota; nada impede auto-revogação.
- **Sintoma sem adapter:** usuário perde acesso à própria tela de permissões; precisa de DBA para reverter.
- **Callsites em risco:** `src/pages/admin/ControleAcessos.tsx`, RPC de toggle.
- **Cobertura:**
  - **UI:** confirmação dupla (`AlertDialog` + digitar "CONFIRMO") quando o toggle remove uma permissão crítica do próprio perfil.
  - **DB:** trigger `BEFORE UPDATE/DELETE` em `profile_permissions` levanta `RAISE EXCEPTION 'autolockout_blocked'` se a operação deixaria o invocador sem a chave crítica.
  - **Escape válvula:** `force_unlock_permission` (ver BC-18).
- **Sinal:** `logs_prospeccoes` recebe entrada `source='system' action='autolockout_blocked'` toda vez que a trigger barra.
- **Critério de saída:** trava é permanente; é proteção, não shim.
- **Risco residual:** lista de permissões "críticas" deve ser configurável (`is_critical` em `auth_permissions`) — começa hardcoded em F2, vira coluna em F3.

### BC-08 — `departamento_permissoes` vira read-only (sincronia unidirecional)
- **Gatilho:** F2 — primeira escrita feita na tabela nova após o cutover.
- **Raiz:** hoje a tabela antiga é fonte da verdade; escritas vêm de `ControleAcessos.tsx`.
- **Sintoma sem adapter:** código legado que ainda lê `departamento_permissoes` (não migrado) veria valores defasados, gerando UX divergente entre Master e usuário comum.
- **Callsites em risco:** `useUserAccessType.ts` (fase de coexistência), qualquer SQL/RPC ad-hoc que faça `SELECT FROM departamento_permissoes`.
- **Cobertura:** trigger `AFTER INSERT/UPDATE/DELETE` em `profile_permissions` espelha a linha na tabela antiga; sem trigger inversa.
- **Sinal:** `pg_stat_user_tables` em `departamento_permissoes` — coluna `n_tup_upd` deve crescer apenas a partir da trigger; `logs_prospeccoes` registra cada sync com `source='system'`.
- **Critério de saída:** F4 — drop da tabela antiga quando `LEGACY_TO_NEW` ficar vazio.
- **Risco residual:** se algum job batch (edge function não mapeada) escrever direto na antiga, o write será **rejeitado** (ver BC-09) — exige inventário prévio.

### BC-09 — Escritas diretas em `departamento_permissoes` passam a falhar com erro nomeado
- **Gatilho:** F2, qualquer escrita externa fora da sincronia (BC-08).
- **Raiz:** novo trigger `BEFORE INSERT/UPDATE/DELETE` em `departamento_permissoes` com **checagem inteligente OLD vs NEW**: se a linha equivalente em `profile_permissions` já reflete o novo valor (origem foi a sincronia), passa silenciosamente; senão `RAISE EXCEPTION 'departamento_permissoes_is_read_only_use_profile_permissions'`.
- **Sintoma sem adapter:** edge function ou script legado quebra em runtime com erro técnico não traduzido.
- **Callsites em risco:** edge functions `manage-users`, `cleanup-invalid-users`; qualquer migration antiga não revisada; scripts manuais de operação.
- **Cobertura:** o adapter **não disfarça** — é uma trava de design. Documento exige inventário em F1 (`rg "departamento_permissoes"` em `supabase/`, scripts e edge functions).
- **Sinal:** erros 23P01 com mensagem `departamento_permissoes_is_read_only_use_profile_permissions` em `supabase` logs.
- **Critério de saída:** F4 (tabela deletada).
- **Risco residual:** edge functions externas (n8n, fora do repo) podem escrever direto — risco operacional; mitigar com revoke de `INSERT/UPDATE/DELETE` para roles externos em F1.

### BC-10 — `valor jsonb` rejeitado se não casar com `parameter_schema` (`pg_jsonschema`)
- **Gatilho:** F0+ — qualquer escrita em `profile_permissions.restriction`.
- **Raiz:** hoje `valor` é validado só no front (`PermissionRegistry.ts:159-192`); banco aceita qualquer JSON.
- **Sintoma sem adapter:** payload malformado quebra consumidor (ex.: `ImportarDoDataLake.tsx:296`).
- **Callsites em risco:** `ControleAcessos.tsx` (editor de `valor`), qualquer RPC que faça `UPDATE departamento_permissoes SET valor = …`.
- **Cobertura:** `CHECK (jsonb_matches_schema(parameter_schema, restriction))` em `profile_permissions` usando `pg_jsonschema`. Trigger de sincronia (BC-08) propaga apenas valores já validados.
- **Sinal:** erros 23514 com nome de constraint identificável.
- **Critério de saída:** validação é permanente.
- **Risco residual:** se um schema novo for adicionado mais restritivo que dados legados, o backfill F0 precisa **migrar ou rejeitar** valores que não casam; tratar como parte do checklist de F0.

### BC-11 — `getPermissionValor` substituído por `restriction()` (mesma assinatura no shim)
- **Gatilho:** F1 — primeira chamada de `getPermissionValor` após shim ativo.
- **Raiz:** `useUserAccessType.ts:getPermissionValor(key)` lê `permissionValores[key]`.
- **Sintoma sem adapter:** consumidores que esperam o shape antigo (`{ dias_max: number, eventos_permitidos: 'todos' | 'futuros' }`) quebram se o novo `restriction` mudar de shape.
- **Callsites em risco:** `ImportarDoDataLake.tsx`, qualquer leitura de `getPermissionValor`.
- **Cobertura:** shim mantém assinatura pública `getPermissionValor(legacyKey)` e internamente chama `restriction(novaKey)` mapeada por `LEGACY_TO_NEW`. O **shape** é preservado por contrato — `parameter_schema` no F0 deve ser cópia byte-a-byte do `valorSchema` TS atual.
- **Sinal:** `[rbac:restriction-shape mismatch key=<x>]` se shapes divergirem.
- **Critério de saída:** quando consumidores migrarem para `useRbac().restriction()`.
- **Risco residual:** `valorSchema` não é JSON Schema válido hoje — F0 precisa fazer tradução; revisar caso a caso.

### BC-12 — RLS de `departamento_permissoes`/`profile_permissions` deixa de gatear por string `tipo_acesso`
- **Gatilho:** F2, primeira escrita real na nova tabela.
- **Raiz:** policy atual `departamento_permissoes_write_admin_master_ti USING (get_current_user_access_type() = ANY ('{Administrador,Master,TI}'))` — string fixa.
- **Sintoma sem adapter:** se um Admin novo for criado via SSO com `tipo_acesso` levemente diferente (espaços, capitalização), perde escrita; inversamente, `tipo_acesso='Administrador'` continua escrevendo mesmo se a permissão `global:admin_controle_acessos:write` estiver desligada.
- **Callsites em risco:** SQL `INSERT/UPDATE` em `profile_permissions` via PostgREST.
- **Cobertura:** nova policy em `profile_permissions` usa `has_permission(auth.uid(), 'global:admin_controle_acessos:write')`. A policy antiga em `departamento_permissoes` é **removida** (tabela vira read-only — ver BC-08).
- **Sinal:** `pg_stat_user_tables` + logs do PostgREST (`PGRST`) — qualquer 403 inesperado em F2 deve ser investigado nas primeiras 48h.
- **Critério de saída:** policy nova é permanente.
- **Risco residual:** circular — para escrever a primeira linha que **dá** `global:admin_controle_acessos:write` ao Master, precisamos do seed F0 já tendo `*:*:*`. F0 roda como `service_role` (bypassa RLS), então OK.

### BC-13 — Wildcard `*:*:*` exige glob matching consistente client+server
- **Gatilho:** F1, primeira resolução com wildcard.
- **Raiz:** hoje não há wildcard; client e server resolvem por igualdade exata.
- **Sintoma sem adapter:** divergência entre `has_permission` (SQL) e `useRbac().can()` (TS) — UI mostra botão habilitado e RPC retorna 403, ou vice-versa.
- **Callsites em risco:** todo `<Can>` + toda policy RLS que use `has_permission`.
- **Cobertura:**
  - Implementação única do algoritmo (peso = nº de segmentos não-`*`, específico vence genérico) testada em **fixture compartilhada** entre TS e SQL (mesmos 30+ casos rodados em Vitest + `pgTAP`-style asserts).
  - Shim usa exatamente a mesma função para mapear chaves legadas.
- **Sinal:** teste de paridade obrigatório no CI antes do merge de F0.
- **Critério de saída:** algoritmo é permanente; o **teste de paridade** é permanente.
- **Risco residual:** negações explícitas (`is_active=false`) vs wildcards: precedência precisa ser documentada **antes** do F0 — proposta: `is_active=false` específico vence wildcard genérico ativo.

### BC-14 — `useUserAccessType` mantém assinatura mas internamente vira shim
- **Gatilho:** F1, todo render que use o hook (≈100% das telas).
- **Raiz:** hook hoje monta `permissions` direto via `resolvePermissions`; F1 redireciona para `useRbac` + `LEGACY_TO_NEW`.
- **Sintoma sem adapter:** mudar a assinatura quebraria ~50 consumidores; o adapter existe justamente para evitar isso.
- **Callsites em risco:** todo consumidor do hook.
- **Cobertura:** as ~50 propriedades nomeadas (`canCreateEventos`, `canDeleteEventos`, …) continuam expostas; internamente cada uma resolve via `LEGACY_TO_NEW[<flag>]`. Quando a chave nova **não existe** em `auth_permissions`, faz fallback para `resolvePermissions` antigo + log `[rbac:fallback] <legacy_key>`.
- **Sinal:** `[rbac:fallback]` — inventário do que ainda falta migrar.
- **Critério de saída:** F4 — quando log fica zerado por X dias + `LEGACY_TO_NEW` vazio.
- **Risco residual:** consumidores que desestruturam o hook (`const { canX, canY } = useUserAccessType()`) **continuam funcionando**, mas leitura de chaves não mapeadas retorna `false` em vez de `undefined` — pode esconder bugs; em F1 logar `[rbac:unknown-key]`.

### BC-15 — Flags órfãs deixam de aparecer no novo catálogo
- **Gatilho:** F0 — quando o seed roda.
- **Raiz:** §3.2/§3.13 do auxiliar — `canManageWebhooks`, `canManagePosVendasCadencia`, etc. existem no registry sem consumidor.
- **Sintoma sem adapter:** UI "Por Perfil" mostra menos flags que antes; contadores diferentes.
- **Callsites em risco:** UI de Controle de Acessos (visualização), nenhuma rota de negócio.
- **Cobertura:** seed F0 **não importa** flags órfãs (lista identificada no auxiliar). `LEGACY_TO_NEW` para essas flags retorna sempre `false` com log `[rbac:orphan-read key=<x>]` — se algum consumidor surgir, vira aviso.
- **Sinal:** `[rbac:orphan-read]`.
- **Critério de saída:** 0 hits em 30 dias → remover flag do mapa.
- **Risco residual:** se órfã for usada por edge function não rastreada, vira `false` em produção — listar todas em F0.

### BC-16 — Contadores "X/120 ativas" mudam de base
- **Gatilho:** F2 — UI passa a ler do novo catálogo.
- **Raiz:** `PermissionProfileView.tsx` itera `PERMISSION_REGISTRY`.
- **Sintoma sem adapter:** denominador muda (≈120 → N novas), gera estranheza visual para admins.
- **Callsites em risco:** `PermissionProfileView`, `PermissionCompareView`, `PermissionModuleView`.
- **Cobertura:** comunicar visualmente (badge "novo catálogo") + tooltip explicando a diferença. Não é adapter de comportamento, é UX.
- **Sinal:** N/A.
- **Critério de saída:** após F4.
- **Risco residual:** screenshots/manuais antigos ficam desatualizados.

### BC-17 — Auditoria preenchida por trigger; `changed_by` nulo para service_role
- **Gatilho:** F0+ — toda mudança em `profile_permissions`.
- **Raiz:** hoje não há auditoria (§3.6).
- **Sintoma sem adapter:** mudanças feitas via edge function (sem `auth.uid()`) gravariam `changed_by=NULL` — pode confundir auditor.
- **Callsites em risco:** `manage-users`, scripts, migrations.
- **Cobertura:** trigger grava `source='service_role'|'migration'|'user'|'system'`; UI de Histórico filtra/colore por `source`. Sessões de migration setam `SET LOCAL app.migration = on`.
- **Sinal:** dashboard de Histórico mostra distribuição de `source`.
- **Critério de saída:** permanente.
- **Risco residual:** se edge function esquecer de setar `app.migration`, vira `service_role` — aceitável.

### BC-18 — `force_unlock_permission` exige MFA recente (Master sem TOTP é bloqueado)
- **Gatilho:** F2 — primeiro uso da válvula de escape do autolockout (BC-07).
- **Raiz:** RPC SECURITY DEFINER nova; sem ela, autolockout exigiria DBA.
- **Sintoma sem adapter:** Master tenta destravar e leva 401 se não passou por TOTP nos últimos 5 min.
- **Callsites em risco:** UI futura "Desbloquear permissão" em `ControleAcessos`.
- **Cobertura:** RPC checa `mfa_master_users` + `mfa_verified_at < 5min`; opera 1 par `(profile_key, permission_key)` por chamada; exige `reason text`; grava `source='system'` no histórico.
- **Sinal:** entradas em `profile_permissions_history` com `source='system'`.
- **Critério de saída:** permanente.
- **Risco residual:** se `mfa_verified_at` não estiver sendo escrito pelo fluxo MFA atual, precisa ser adicionado em F2 antes da RPC ir ao ar.

---

## 4. Não-quebras (garantias do adapter durante F1–F3)

- Assinatura pública de `useUserAccessType` (todas as ~50 props nomeadas + `permissions[key]` + `getPermissionValor`) preservada.
- Props de `PermissionProtectedRoute` (`permissionKey`, `redirectTo`) preservadas.
- `App.tsx` não precisa ser tocado em F1; rotas existentes continuam funcionando.
- Código legado que faz `SELECT FROM departamento_permissoes` continua lendo dados corretos via sincronia unidirecional (BC-08).
- Tela "Por Perfil" continua mostrando os mesmos defaults visíveis (seed F0 é cópia 1:1 do estado atual).
- Edge functions que **leem** `departamento_permissoes` continuam funcionando.

---

## 5. Matriz de cobertura por fase

| Cód.  | Introduzido em | Removível do adapter em | Trava permanente? |
| ----- | -------------- | ----------------------- | ----------------- |
| BC-01 | F1             | F3 (migração callsites) | Não               |
| BC-02 | F1             | F3                      | Não               |
| BC-03 | F1             | F3                      | Não               |
| BC-04 | F1             | F2 (após 14d sem alertas) | **Sim** (wildcard permanente) |
| BC-05 | F1             | F2 (após 14d com `[rbac:bypass-ti]=0`) | Não |
| BC-06 | F1             | F3                      | Não               |
| BC-07 | F2             | —                       | **Sim**           |
| BC-08 | F2             | F4                      | Sincronia some no F4 |
| BC-09 | F2             | F4                      | **Sim** até F4    |
| BC-10 | F0             | —                       | **Sim**           |
| BC-11 | F1             | F3                      | Não               |
| BC-12 | F2             | —                       | **Sim**           |
| BC-13 | F0             | —                       | **Sim** (teste de paridade no CI) |
| BC-14 | F1             | F4                      | Não               |
| BC-15 | F0             | F3 (após 30d sem `[rbac:orphan-read]`) | Não |
| BC-16 | F2             | F4                      | Não (UX)          |
| BC-17 | F0             | —                       | **Sim**           |
| BC-18 | F2             | —                       | **Sim**           |

---

## 6. Limites do adapter (refactor manual obrigatório antes de F4)

Itens **não cobertos** pelo adapter — exigem mudança consciente nos callsites:

1. **Introdução de escopo `tenant`/`local`/`personal`.** O shim resolve tudo como `global` (paridade com legacy). Novos callsites precisam decidir o escopo correto e chamar `useRbac().can('tenant:leads:read')` diretamente; **não há** adaptação automática que descubra escopo a partir de `canViewProspeccao`.
2. **Ownership (`personal`) em `canDelete*`.** Hoje `canDeleteEventos`, `canDeleteContatos`, `canDeleteRecepcaoVisita` não distinguem dono. O shim mantém esse comportamento; refactor para `personal:<recurso>:delete` exige que o callsite passe o `owner_id` do registro, o que o adapter **não** consegue inferir.
3. **Multi-tenant em `canManageUsers`.** Shim retorna global (paridade); a regra correta exige `tenant:usuarios:create` no contexto do `CompanyContext.activeCompanyId`. Gestor que criar usuário em F1–F3 continuará vendo o botão para **todas** as empresas.
4. **`masterOnly` de UI (visibilidade) vs `Master` de perfil.** `useMfaMaster()` é eixo separado (§6.9 do auxiliar) — adapter não unifica; permanece como filtro de UI até decisão explícita.
5. **RLS de tabelas de negócio** (`eventos_prospeccao`, `prospeccoes`, `whatsapp_templates`). Esta migração **não toca** RLS de dados; só catálogo/overrides. RLS dessas tabelas migra em fase própria (referência: §7.2 do auxiliar).

---

## 7. Riscos residuais e telemetria

KPIs propostos para o painel `RBAC Migration Health` (revisar semanalmente em F1–F3):

| Métrica | Fonte | Meta |
| --- | --- | --- |
| `% chamadas via [rbac:fallback]` por chave | logs do client | tendência decrescente; alarme se subir |
| `count([rbac:legacy-resolve] diffFromLegacy=true)` | logs do client | 0 após F1+7d |
| `count([rbac:bypass-ti hit])` | logs do client | 0 após F1+14d (gatilho para BC-05 drop) |
| `count([rbac:orphan-read])` | logs do client | 0 após F0+30d (gatilho para BC-15 drop) |
| `count([rbac:master-wildcard miss])` | logs do client + RPC | 0 sempre (alerta P1) |
| `count(autolockout_blocked)` | `profile_permissions_history` | informativo (esperado > 0 — prova que a trava está viva) |
| Erros 23P01 `departamento_permissoes_is_read_only…` | Supabase logs | 0 após F2+48h |
| Paridade `has_permission` (SQL) × `useRbac().can()` (TS) | suite de fixtures CI | 100% sempre |

Sinais que devem **bloquear** o avanço de fase:

- `[rbac:master-wildcard miss]` > 0 → bloqueia F2.
- `[rbac:bypass-ti hit]` > 0 após 14d → bloqueia drop de BC-05.
- Qualquer erro 23P01 inesperado em produção → bloqueia F3.
- Paridade client/server abaixo de 100% → bloqueia merge de F0.

---

## 8. Próximos passos

1. Revisão deste documento + aprovação da lista BC-01..BC-18.
2. Inventário pré-F0: rodar `rg "departamento_permissoes"` em `supabase/functions/`, `supabase/migrations/`, scripts externos; documentar cada hit.
3. Inventário pré-F0: rodar `rg "canManage|canAccess|canDelete|canEdit|canCreate"` em `src/` para baseline de callsites legados; congelar lista que vai alimentar `LEGACY_TO_NEW`.
4. Decidir precedência **wildcard ativo vs específico negado** (BC-13) — proposta no doc precisa de OK explícito.
5. Confirmar que `mfa_verified_at` é gravado pelo fluxo MFA atual (pré-requisito de BC-18); senão adicionar antes de F2.
6. Após aprovações: abrir PR de F0 com migration + seed + fixtures de paridade.