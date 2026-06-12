
# Plano: documento auxiliar de Controle de Acessos

Criar **`docs/controle-acessos-auxiliar-detalhado.md`** consolidando o mapeamento problema/modelo atual da tela `/administracao/controle-acessos`, cruzando seções 4.1–4.13, 5 e 8 do `docs/controle-acessos.md`, e estruturando a base para um modelo RBAC fino `Escopo > Recurso > Ação`. **Sem propor solução** — apenas diagnóstico, evidência técnica e gaps.

## Estrutura do documento

1. **Objetivo e escopo do auxiliar**
   - Para que serve, o que NÃO está no escopo (solução virá depois).
   - Referência cruzada com `docs/controle-acessos.md`.

2. **Mapa rápido do modelo atual (resumo técnico)**
   - Camadas: `PermissionRegistry.ts` (defaults) → `departamento_permissoes` (overrides) → `useUserAccessType.ts` (resolução) → consumidores (`PermissionProtectedRoute`, `AdminProtectedRoute`, `TIAdminProtectedRoute`, flags nomeadas).
   - Citação literal de trechos hardcoded relevantes (Master force-true linhas 67-71 do hook, bypass `isDepartamentoTI && isAdminOrTI`, guards de rota `Administrador/Master/TI`, RLS `INSERT/UPDATE/DELETE`).

3. **Inconsistências detalhadas — expansão de 4.1 a 4.13**
   Para cada item:
   - **ID** (4.x) e título.
   - **Sintoma observável** (UX/runtime).
   - **Raiz técnica** com arquivo:linha e snippet hardcoded (hook, registry, componentes, RLS).
   - **Camada afetada** (UI / hook / banco / RLS / guard de rota).
   - **Tipo de problema** (incoerência UI×runtime, bypass implícito, lock-out, ausência de auditoria, granularidade insuficiente, etc.).

4. **Cruzamento 4.x ↔ Seção 5 (resumo executivo)**
   Tabela: cada linha da seção 5 → quais subitens 4.x cobre, severidade declarada, e se há subitem 4.x **não representado** na seção 5 (gap de resumo).

5. **Cruzamento (4.x ∪ 5) ↔ Seção 8 (recomendações)**
   Tabela de cobertura: para cada bullet de §8, mapear quais inconsistências cobre. Marcar:
   - Itens 4.x **sem recomendação correspondente** (gaps de §8).
   - Itens 4.x **parcialmente cobertos** (recomendação trata sintoma e não raiz).
   - Recomendações de §8 que tocam **mais de um** subitem 4.x.
   - Conclusão objetiva: o que §8 NÃO endereça hoje.

6. **Inventário dos hardcodes que sustentam o modelo atual**
   Subseções com trechos do código atual (sem reescrever):
   - 6.1 Force-true do Master no hook.
   - 6.2 Bypass `isDepartamentoTI && isAdminOrTI` em `canAccessAgentesIA`.
   - 6.3 Guards de rota dedicados (`AdminProtectedRoute`, `TIAdminProtectedRoute`) paralelos ao `PermissionProtectedRoute`.
   - 6.4 RLS `departamento_permissoes` fixando `Administrador/Master/TI` como editores.
   - 6.5 Defaults por perfil em `getDefaultPermissions()` (acoplamento de regra de negócio em TS).
   - 6.6 Flags nomeadas no hook duplicando o mapa `permissions[key]`.
   - 6.7 Ausência de `updated_by` e tabela de log.
   - 6.8 `valor jsonb` validado só no front (`valorSchema`).
   - 6.9 `masterOnly` no registry (mais um caminho de visibilidade fora do RBAC).
   - 6.10 Cache de permissões em memória (sem realtime/invalidação).

7. **Mapeamento para um modelo RBAC `Escopo > Recurso > Ação`**
   Apenas **mapeamento descritivo** do estado atual no formato alvo, **sem desenhar a solução**.
   - 7.1 Definição dos eixos:
     - **Escopo** (ex.: global, empresa, departamento real, perfil, usuário, recurso específico).
     - **Recurso** (ex.: `eventos_prospeccao`, `whatsapp_templates`, `agentes_ia`, `controle_acessos`, `usuarios`, `kanban`, `mfa.vault`, `pos_vendas.cadencia`).
     - **Ação** (ex.: `view`, `create`, `edit`, `delete`, `dispatch`, `import`, `clone`, `assign`, `audit_read`).
   - 7.2 Tabela: cada flag atual do `PERMISSION_REGISTRY` traduzida para `(escopo, recurso, ação)` com observações de granularidade perdida (ex.: `canDeleteEventos` não distingue eventos próprios vs. de outros; `canImportPool` precisa parâmetro `dias_max` hoje vivendo em `valor jsonb`).
   - 7.3 Tabela de **parametrizações já existentes** (`hasValor` + `valorSchema`) que viram **constraints do RBAC** (ex.: `eventos_permitidos`, `dias_max`).
   - 7.4 Tabela de **bypasses e exceções** que precisam virar regra explícita: Master force-true, TI departamento, `masterOnly`, guards específicos.
   - 7.5 Lista de **lacunas de granularidade** evidentes ao tentar enquadrar o atual no modelo:
     - Ações fundidas (ex.: `canManageEventos` agrega create/edit/delete/dispatch).
     - Escopo ausente (tudo é por perfil global; sem por empresa, por departamento real, por ownership).
     - Recursos implícitos (flags com nome de UI, não de domínio).
     - Flags órfãs sem recurso real (4.2).
     - Ações duplicadas entre flag e guard de rota dedicado.

8. **Riscos consolidados do modelo atual**
   - Lock-out (4.4) com referência a `App.tsx` + `PermissionProtectedRoute`.
   - Bypass invisível (4.3, 6.2).
   - UI×runtime divergentes para Master (4.1, 4.9, 6.1).
   - Auditoria zero (4.6, 6.7).
   - Falsa sensação de controle por flags órfãs (4.2, 4.13).
   - Granularidade insuficiente para multi-tenant real (CompanyContext existe, mas não entra no RBAC).
   - Configuração crítica (`valor jsonb`) sem validação server-side (4.10, 6.8).

9. **Checklist de pontos a endereçar** (somente lista, sem solução)
   Bullets numerados cruzando 4.x, 5, 6.x e 7.5 — base que o usuário usará para propor a solução depois.

10. **Anexos**
    - A. Lista completa das ~120 flags por módulo (`PERMISSION_MODULES` × `PERMISSION_REGISTRY`) com coluna “consumidor encontrado? sim/não/parcial” (preencher a partir de `rg` no código).
    - B. Lista dos 12 `TIPOS_ACESSO` com defaults relevantes (Admin/Master/TI) e o tratamento especial de cada um no hook e nos guards.
    - C. Mapa de rotas protegidas vs. flag exigida (extrair de `src/App.tsx`).

## Arquivos consultados para escrever o documento
- `docs/controle-acessos.md` (base).
- `src/components/controle-acessos/PermissionRegistry.ts` (módulos, registry, defaults, `masterOnly`, `hasValor/valorSchema`).
- `src/hooks/useUserAccessType.ts` (force-true Master, bypass TI, flags nomeadas).
- `src/components/AdminProtectedRoute.tsx`, `PermissionProtectedRoute.tsx`, `TIAdminProtectedRoute.tsx`, `GestorProtectedRoute.tsx`.
- `src/pages/admin/ControleAcessos.tsx` + `PermissionModuleView/ProfileView/CompareView`.
- `src/App.tsx` (rotas e chaves usadas).
- Migrations de `departamento_permissoes` (RLS, colunas, índices).
- `rg` por `permissions[`, `p("`, `canAccess`, `canManage`, `canCreate` etc. para popular o anexo A.

## Arquivos a alterar
- **Criar**: `docs/controle-acessos-auxiliar-detalhado.md`.
- Nenhum código, nenhuma migration, nenhuma flag. Documento apenas.

## Fora de escopo (explícito)
- Não propor RBAC novo, schema novo, RLS nova, refactor do hook, nem deprecação de flag.
- Não tocar em `PermissionRegistry.ts`, `useUserAccessType.ts`, `departamento_permissoes`, rotas, ou UI.
- Não atualizar `docs/controle-acessos.md` (auxiliar é documento separado).

