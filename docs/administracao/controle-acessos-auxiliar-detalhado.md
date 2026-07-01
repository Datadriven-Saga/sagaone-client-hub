# Controle de Acessos — Documento Auxiliar Detalhado

> Documento complementar de [`controle-acessos.md`](./controle-acessos.md). **Escopo:** mapear de forma técnica e exaustiva o **modelo atual** (problema), cruzar as inconsistências listadas em §4.1–§4.13 com o resumo executivo (§5) e as recomendações (§8), e organizar tudo num formato que possa ser endereçado por um RBAC de granularidade fina no eixo **Escopo > Recurso > Ação**.
>
> **Fora de escopo:** propor solução, redesenhar schema, refatorar hooks/RLS ou deprecar flags. Esse documento serve como base de evidência para o desenho da solução, que será feito em uma etapa seguinte pelo time.

---

## 1. Objetivo

1. Consolidar, em um só lugar, **toda a evidência técnica** (com arquivo:linha e trechos hardcoded) por trás de cada inconsistência registrada em §4.x do documento base.
2. Validar que o **resumo executivo §5** representa de fato §4.x — apontando gaps.
3. Validar que as **recomendações §8** cobrem §4.x ∪ §5 — apontando gaps.
4. Apresentar o **dicionário do modelo atual** já reorganizado nos eixos `Escopo > Recurso > Ação`, sem ainda definir um novo schema, para que a solução seja desenhada sobre essa fotografia.

Tudo aqui é descritivo. Onde aparecem palavras como “lacuna”, “bypass”, “falsa sensação”, é diagnóstico, não recomendação.

---

## 2. Mapa rápido do modelo atual

Camadas do controle de acessos, na ordem de avaliação em runtime:

```text
PermissionRegistry.ts (TS, in-repo)
  ├─ PERMISSION_MODULES        ── 23 módulos, alguns masterOnly
  ├─ PERMISSION_REGISTRY       ── ~125 entradas (key/label/moduleId/action [, hasValor/valorSchema])
  ├─ TIPOS_ACESSO              ── 12 perfis (SDR, Vendedor, CRM, Recepcionista, Gerente de Leads,
  │                                Gerente de Loja, Coordenadora de Leads, Diretor, TI,
  │                                Administrador, Proprietário, Master)
  ├─ getDefaultPermissions(tipo)  ── baseline true/false por perfil (hardcoded em TS)
  └─ resolvePermissions(tipo, overrides) ── default ◁ override

departamento_permissoes (Postgres)
  ├─ colunas: departamento(text=tipo_acesso), permissao(text), ativo(bool),
  │            valor(jsonb), updated_at(timestamp)
  └─ RLS:
      ├─ SELECT TO authenticated USING (true)
      └─ ALL    TO authenticated USING (get_current_user_access_type() IN
                                          ('Administrador','Master','TI'))

useUserAccessType.ts (client hook)
  1. profiles.tipo_acesso + profiles.departamento
  2. SELECT * FROM departamento_permissoes
  3. resolvePermissions(tipo, overrides do tipo atual)
  4. if (tipo === "Master") => force true em TODAS as keys (linhas 67-71)
  5. expõe permissions[key] + ~50 flags nomeadas + getPermissionValor(key)
  6. canAccessAgentesIA: p("canAccessAgentesIA") || (isDepartamentoTI && isAdminOrTI)  ← bypass implícito

Consumidores:
  ├─ <PermissionProtectedRoute permissionKey="..." />  (App.tsx, ~60 rotas)
  ├─ <AdminProtectedRoute />                            (rota Administracao via tipo_acesso)
  ├─ <TIAdminProtectedRoute />                          (Agentes IA: canAccessAgentesIA)
  ├─ <GestorProtectedRoute />                           (gestores)
  ├─ permissions[key] / p(key) dentro de componentes (Sidebar, Index, Prospeccao, etc.)
  └─ getPermissionValor(key) para flags hasValor (ex.: ImportarDoDataLake)
```

Pontos críticos do mapa, que serão referenciados ao longo do documento:

- **Default é código, não dado.** Mudar baseline exige deploy.
- **Override é dado, mas sem auditoria** (`updated_by` ausente; sem tabela de log).
- **Master é resolvido em runtime no client** (force-true), não no banco — UI usa o `resolvePermissions` cru, sem o force-true.
- **TI tem caminho duplo** para chegar em `canAccessAgentesIA`: pela flag e pelo `isDepartamentoTI`.
- **RLS de `departamento_permissoes`** confere via `get_current_user_access_type()` retornando `Administrador|Master|TI` — depende de `tipo_acesso` (string), não do mesmo registro de permissões.
- **Cache em memória**: o hook só relê quando `user` muda. Mudança em produção só chega ao usuário-alvo após refresh/login.

---

## 3. Inconsistências detalhadas — §4.1 a §4.13

Para cada item: **Sintoma observável → Raiz técnica (arquivo:linha + snippet) → Camada afetada → Tipo do problema**.

### 3.1 §4.1 — Perfil `Master` não é editável de fato

- **Sintoma:** UI mostra switches habilitados para `Master`. Salvar funciona (UPSERT em `departamento_permissoes`). Recarregar mostra o valor salvo. Mas o usuário Master continua com acesso a tudo.
- **Raiz técnica:** `src/hooks/useUserAccessType.ts:67-71`

  ```ts
  // Master role: force all permissions to true (superadmin)
  if (tipo === "Master") {
    for (const key of Object.keys(resolved)) {
      resolved[key] = true;
    }
  }
  ```

- **Camada afetada:** hook (client). Banco aceita o override mas runtime ignora.
- **Tipo:** incoerência **UI × runtime**; promessa de UI quebrada.

### 3.2 §4.2 — Permissions órfãs (sem consumidor)

- **Sintoma:** admin ativa/desativa flags que não causam nenhum efeito de produto.
- **Raiz técnica:** as flags existem em `PERMISSION_REGISTRY` mas não aparecem em nenhum `p("key")`, `permissions["key"]`, `permissionKey="key"`, nem como flag nomeada no hook.
  Indícios (a confirmar via grep no Anexo A):
  - `canManageWebhooks` — só aparece em `PermissionRegistry.ts:270` e em `getDefaultPermissions:477`. Não há consumidor.
  - `canManagePosVendasCadencia`, `canManagePosVendasTemplates`, `canManagePosVendasLojas` — rotas `/pos-vendas/*` usam `canAccessPosVendas` (App.tsx:130-141).
  - `canCreateGatilhos`, `canEditGatilhos`, `canDeleteGatilhos` — rota `/gatilhos` usa `canAccessGatilhos` (App.tsx:123).
  - `canManageDocumentos`, `canManageProdutos` — declaradas mas sem consumidor mapeado.
- **Camada afetada:** registry, banco (overrides irrelevantes), UI (contadores enganosos).
- **Tipo:** **dívida de inventário**; flag existe sem recurso/ação real associada.

### 3.3 §4.3 — Bypass invisível por depto TI em `canAccessAgentesIA`

- **Sintoma:** admin desliga `canAccessAgentesIA` para o perfil `TI`. Usuários com `profiles.departamento = "TI"` continuam vendo o módulo.
- **Raiz técnica:** `src/hooks/useUserAccessType.ts:138`

  ```ts
  canAccessAgentesIA: p("canAccessAgentesIA") || (isDepartamentoTI && isAdminOrTI),
  ```

  + `src/components/TIAdminProtectedRoute.tsx` (guard de `/agentes-ia/...` em alguns pontos) lê esse mesmo `canAccessAgentesIA`.
- **Camada afetada:** hook + guard.
- **Tipo:** **bypass implícito**; regra existe só no código, invisível na UI.

### 3.4 §4.4 — Risco de lock-out

- **Sintoma:** se admin desligar `canAccessControleAcessos` para `Administrador`, ele mesmo perde acesso à tela. Idem `canAccessAdministracao`.
- **Raiz técnica:**
  - `src/App.tsx:169` — `<PermissionProtectedRoute permissionKey="canAccessControleAcessos">`.
  - `getDefaultPermissions:434` — `defaults.canAccessControleAcessos = isAdmin;` (só Administrador/Master por default).
  - `PermissionProtectedRoute.tsx:54` — redireciona para `/` quando `keys.some(...) !== true`.
  - UI (`ControleAcessos.tsx:handleToggle`) não bloqueia auto-revogação.
- **Camada afetada:** UI + roteamento.
- **Tipo:** **risco operacional crítico**; UI não tem trava de auto-revogação.

### 3.5 §4.5 — Filtro “por perfil” em Por Módulo é confuso

- **Sintoma:** selecionar perfil no filtro de Por Módulo esconde permissões — usuário pensa que sumiram.
- **Raiz técnica:** `PermissionModuleView.tsx` aplica filtro mostrando apenas onde `resolved[perm.key] === true` para o perfil escolhido, sem label “somente ativas”.
- **Camada afetada:** UI.
- **Tipo:** **UX**, sem implicação de segurança.

### 3.6 §4.6 — Falta de auditoria

- **Sintoma:** impossível responder “quem mudou X em Y”.
- **Raiz técnica:** `departamento_permissoes` tem apenas `updated_at`. Sem `updated_by`, sem `created_at`, sem tabela `departamento_permissoes_logs`. Nenhuma trigger de auditoria.
- **Camada afetada:** banco.
- **Tipo:** **compliance / observabilidade**.

### 3.7 §4.7 — Sem confirmação destrutiva

- **Sintoma:** toggle de `canManageUsers`, `canAccessControleAcessos`, `canDeleteUsers`, `canDispararEventos`, etc. salva no primeiro clique. `Clonar perfil` substitui todas as flags do destino sem undo.
- **Raiz técnica:** `ControleAcessos.tsx:handleToggle` faz upsert otimista direto. `handleCloneProfile` envia batch UPSERT direto, sem diff visível e sem soft-undo.
- **Camada afetada:** UI.
- **Tipo:** **risco operacional**; falta cinto de segurança.

### 3.8 §4.8 — `valor jsonb` só editável em “Por Módulo”

- **Sintoma:** quem entra em “Por Perfil” não vê que `canImportPool.dias_max`, `canImportPoolFull.dias_max`, `canImportPoolReadOnly.eventos_permitidos` etc. existem.
- **Raiz técnica:** `PermissionProfileView.tsx` e `PermissionCompareView.tsx` não renderizam o painel de `valorSchema`. Schema vive em `PermissionRegistry.ts:159-192`.
- **Camada afetada:** UI.
- **Tipo:** **descobribilidade**; configuração fundamental escondida.

### 3.9 §4.9 — Inconsistência visual Master no Authenticator

- **Sintoma:** Authenticator mostra `0/4` para Vendedor mesmo Master tendo tudo `true` em runtime.
- **Raiz técnica:** UI calcula `activeCount` direto de `getDefaultPermissions + overrides`. O force-true do Master só existe em `useUserAccessType.ts:67-71`, não em `resolvePermissions` (`PermissionRegistry.ts:532-542`).
- **Camada afetada:** UI + Registry.
- **Tipo:** mesma raiz de §4.1 (UI × runtime divergem para Master).

### 3.10 §4.10 — `valor jsonb` sem validação no banco

- **Sintoma:** UPDATE direto via SQL pode salvar `{"dias_max":"abc"}` ou estrutura desconhecida e quebrar consumidores (ex.: `ImportarDoDataLake.tsx:296`).
- **Raiz técnica:** `valorSchema` é só TS (`PermissionRegistry.ts:27-37` + por entrada). Banco não tem `CHECK`, não tem JSON Schema validator, não tem trigger. RLS aceita qualquer JSON.
- **Camada afetada:** banco.
- **Tipo:** **falta de contrato server-side** para configurações.

### 3.11 §4.11 — Cache de permissões no client

- **Sintoma:** mudança em `departamento_permissoes` só reflete no usuário-alvo após login/refresh.
- **Raiz técnica:** `useUserAccessType.ts:24` — `useEffect(..., [user])`. Sem `supabase.channel(...).on('postgres_changes', ...)`, sem invalidação cross-session, sem broadcast.
- **Camada afetada:** hook.
- **Tipo:** **latência de propagação**.

### 3.12 §4.12 — Sem busca por chave técnica

- **Sintoma:** ao debugar, dev quer buscar `canManageUsers`; busca filtra por label “Gerenciar usuários”.
- **Raiz técnica:** `PermissionModuleView.tsx` filtra `perm.label.toLowerCase().includes(query)` (não inclui `perm.key`).
- **Camada afetada:** UI.
- **Tipo:** **DX / debugging**.

### 3.13 §4.13 — Contadores incluem flags órfãs

- **Sintoma:** “X/120 ativas / Y customizadas / Z desativadas” conta tudo no Registry, inclusive flags sem consumidor.
- **Raiz técnica:** `PermissionProfileView.tsx` itera `PERMISSION_REGISTRY` para somar `activeCount/customCount`. Não cruza com inventário de consumidores (que nem existe).
- **Camada afetada:** UI + falta de metadata (`status: stable|orphan|deprecated` por entrada).
- **Tipo:** **observabilidade**; falsa sensação de controle.

---

## 4. Cruzamento §4.x ↔ §5 (Resumo Executivo)

Cada linha de §5 com a lista de subitens §4.x que ela cobre.

| Linha §5 (severidade) | Texto resumido                                                        | Cobre §4.x        | Comentário                                                                                    |
| --------------------- | --------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| Alta                  | Master force-true não refletido na UI                                 | §4.1, §4.9        | Cobertura completa.                                                                           |
| Alta                  | Lock-out de admin ao desligar `canAccessControleAcessos/Administracao`| §4.4              | Cobertura completa.                                                                           |
| Alta                  | Bypass invisível por depto TI                                         | §4.3              | Cobertura completa.                                                                           |
| Média                 | Flags órfãs sem consumidor                                            | §4.2              | Cobre o sintoma, **não cita §4.13** (contadores) que é derivado direto disso.                  |
| Média                 | Sem auditoria                                                         | §4.6              | Cobertura completa.                                                                           |
| Média                 | Sem confirmação destrutiva / Clonar irreversível                      | §4.7              | Cobertura completa.                                                                           |
| Média                 | `valor jsonb` só editável em uma aba                                  | §4.8              | **Não inclui §4.10** (validação server-side), que é tema relacionado mas mais grave.           |
| Baixa                 | Cache sem realtime                                                    | §4.11             | Cobertura completa.                                                                           |
| Baixa                 | Filtro “Por perfil” enganoso                                          | §4.5              | Cobertura completa.                                                                           |
| Baixa                 | Sem busca por chave técnica                                           | §4.12             | Cobertura completa.                                                                           |
| Baixa                 | Contadores misturam flags órfãs                                       | §4.13             | Listado, mas o **link causal** com §4.2 não está explicitado em §5.                            |

**Gaps de §5:**

- §4.10 (validação de `valor jsonb` no banco) **não aparece** como linha própria. Está implicitamente colado a §4.8 mas a severidade real é **Média/Alta** (configuração regulatória, vide `canRegisterExternalOptOut`).
- §4.13 está com severidade Baixa, mas, como decorre de §4.2 (Média), o impacto cumulativo é maior — não há agrupamento.
- §5 não diferencia **escopo de risco** (segurança vs UX vs observabilidade vs compliance).

---

## 5. Cruzamento (§4.x ∪ §5) ↔ §8 (Recomendações)

Tabela: para cada bullet de §8, marca quais §4.x cobre, e se aborda **raiz** ou só **sintoma**.

| §8 (bullet)                                                                       | Cobre §4.x   | Trata raiz?       | Notas                                                                                              |
| --------------------------------------------------------------------------------- | ------------ | ----------------- | -------------------------------------------------------------------------------------------------- |
| Bloquear/ocultar edição do perfil `Master`                                        | §4.1         | Sintoma           | Não remove o force-true do hook; só esconde a UI. §4.9 continua vivo até o item “forçar Master true no `getDefaultPermissions`”. |
| Bloquear toggle de `canAccessControleAcessos` para o próprio perfil               | §4.4         | Parcial           | Resolve auto-revogação do próprio perfil, **não** auto-revogação do próprio usuário/empresa nem o caso `canAccessAdministracao`. |
| Coluna `updated_by` + tabela de log                                               | §4.6         | Raiz              | Cobertura completa.                                                                                |
| Marcador visual de flags órfãs (lint static)                                      | §4.2         | Parcial           | Marca visualmente, não remove nem corrige contadores (§4.13).                                      |
| Mover bypass do depto TI para flag explícita / documentar                         | §4.3         | Raiz (se mover)   | Se apenas “documentar”, vira sintoma.                                                              |
| Invalidação/realtime nas permissões                                               | §4.11        | Raiz              | Cobertura completa.                                                                                |
| Confirmação no Clonar + “merge vs substituir”                                     | §4.7         | Raiz (parcial)    | Não cobre o caso de toggles individuais em flags críticas.                                         |
| Editar `valor jsonb` em “Por Perfil”                                              | §4.8         | Raiz              | Cobertura completa. **Não** endereça §4.10.                                                        |
| Busca por chave técnica                                                           | §4.12        | Raiz              | Cobertura completa.                                                                                |
| Forçar `Master` true no `getDefaultPermissions`                                   | §4.1, §4.9   | Raiz              | Cobertura completa do plano UI; **não** elimina o force-true do hook, apenas alinha contadores.    |

**Cobertura por §4.x:**

| §4.x  | Status §8                                  |
| ----- | ------------------------------------------ |
| §4.1  | Endereçado (UI ocultar + alinhar contadores). |
| §4.2  | **Parcial** (marcador, sem decisão de manter/remover/escopo).                  |
| §4.3  | **Condicional** (depende de “mover” vs “documentar”).                         |
| §4.4  | **Parcial** (só auto-revogação por perfil; sem trava por usuário).            |
| §4.5  | **Não endereçado**.                          |
| §4.6  | Endereçado.                                  |
| §4.7  | **Parcial** (Clonar sim; toggles críticos individuais não).                   |
| §4.8  | Endereçado.                                  |
| §4.9  | Endereçado (decorrente).                     |
| §4.10 | **Não endereçado**.                          |
| §4.11 | Endereçado.                                  |
| §4.12 | Endereçado.                                  |
| §4.13 | **Não endereçado** (depende de §4.2).        |

**Conclusão objetiva — o que §8 NÃO endereça hoje:**

1. **Validação server-side de `valor jsonb`** (§4.10). Risco real para `canRegisterExternalOptOut`, `canImportPool*`.
2. **Filtro confuso em Por Módulo** (§4.5).
3. **Confirmação destrutiva fora do Clonar** — toggles de flags críticas continuam sem rede (§4.7).
4. **Contadores enganosos** (§4.13) e **decisão sobre flags órfãs** (§4.2): §8 apenas “marca”, não decide.
5. **Lock-out por usuário** (§4.4) — bloquear no nível de perfil resolve apenas parte.
6. **Multi-tenant / escopo por empresa**: nenhum item de §4.x nem §8 trata o fato de que **CompanyContext existe** e o RBAC ignora `empresa_id` na avaliação de permissão.
7. **Ownership** (próprio vs alheio): `canDeleteEventos`/`canDeleteContatos`/etc. não distinguem dono do registro.
8. **Departamento real vs perfil**: o nome da coluna `departamento` armazena o `tipo_acesso` (perfil). O conceito de departamento real (RH, TI, Comercial) só aparece como bypass implícito em §4.3.

---

## 6. Inventário dos hardcodes que sustentam o modelo atual

Os trechos abaixo são citados como **estado atual**, não como propostas a manter ou refatorar.

### 6.1 Force-true do Master (client-only)

`src/hooks/useUserAccessType.ts:67-71`
```ts
if (tipo === "Master") {
  for (const key of Object.keys(resolved)) {
    resolved[key] = true;
  }
}
```

Implicações:
- Toda flag, inclusive flags futuras, vira `true` para Master sem precisar registry-edit.
- A UI de Controle de Acessos não aplica esse passo (origem do §4.1, §4.9).
- RLS de outras tabelas que dependem de `get_current_user_access_type() = 'Master'` funciona; RLS que dependem de uma flag específica em `departamento_permissoes` **não** veem o force-true.

### 6.2 Bypass depto TI em `canAccessAgentesIA`

`src/hooks/useUserAccessType.ts:138`
```ts
canAccessAgentesIA: p("canAccessAgentesIA") || (isDepartamentoTI && isAdminOrTI),
```

- `isDepartamentoTI = (departamento ?? "").trim().toUpperCase() === "TI"` (linha ~108).
- A regra é **OR** com a flag — não há como “desligar” o bypass via UI.

### 6.3 Guards de rota dedicados paralelos ao `PermissionProtectedRoute`

- `src/components/AdminProtectedRoute.tsx` — usa `isAdmin` (`tipo_acesso ∈ {Administrador, Master}`).
- `src/components/TIAdminProtectedRoute.tsx` — usa `canAccessAgentesIA` (que carrega o bypass §6.2).
- `src/components/PermissionProtectedRoute.tsx` — usa `permissions[key]` (modelo flags).
- `src/components/GestorProtectedRoute.tsx` — usa flags de gestor.

Implicação: três caminhos de autorização coexistem. Mudança de flag não necessariamente atinge rotas guardadas por `AdminProtectedRoute`/`TIAdminProtectedRoute`.

### 6.4 RLS de `departamento_permissoes`

`supabase/migrations/20260608205458_...sql`
```sql
CREATE POLICY departamento_permissoes_select_authenticated
  ON public.departamento_permissoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY departamento_permissoes_write_admin_master_ti
  ON public.departamento_permissoes
  FOR ALL TO authenticated
  USING (get_current_user_access_type() = ANY (ARRAY['Administrador','Master','TI']))
  WITH CHECK (get_current_user_access_type() = ANY (ARRAY['Administrador','Master','TI']));

GRANT SELECT ON public.departamento_permissoes TO authenticated;
```

- Escritor é determinado por `tipo_acesso` (string fixa no SQL), **não** pela flag `canAccessControleAcessos`. Mudar a flag não fecha nem abre a porta SQL.
- SELECT é aberto a qualquer autenticado.

### 6.5 Defaults por perfil hardcoded em TS

`PermissionRegistry.ts:316-502` (função `getDefaultPermissions`). 12 perfis × ~125 flags = ~1500 decisões em forma de `OR` booleano sobre identidade de perfil.

Exemplos de granularidade insuficiente já presentes nesse bloco:
- `defaults.canDeleteEventos = isAdminOrTI;` — não distingue eventos próprios vs alheios.
- `defaults.canEditClientes = isAdmin || isCRM || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads;` — fileira de OR por perfil; sem escopo de empresa.
- `defaults.canViewClientes = true;` — true para todos os 12 perfis, inclusive `Recepcionista`.
- `defaults.canCreateUsers = isAdminOrTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;` — gestor pode criar usuário sem escopo de empresa.

### 6.6 Flags nomeadas duplicando o mapa

`useUserAccessType.ts:138-188` expõe ~50 propriedades nomeadas (`canCreateEventos`, `canDeleteEventos`, etc.) além de `permissions[key]`. Consumidores misturam os dois estilos (`p("can...")` vs `canDeleteEventos`), gerando duas superfícies de leitura para a mesma flag.

### 6.7 Ausência de `updated_by` e tabela de log

Schema de `departamento_permissoes` (inferido da KB e do código): `departamento, permissao, ativo, valor, updated_at`. Sem `updated_by`, `created_at`, `created_by`. Sem `departamento_permissoes_logs`.

### 6.8 `valor jsonb` validado só no front

`PermissionRegistry.ts:159-192` (Pool/ImportPool) e `27-37` (interface) descrevem o schema. Consumidor (`ImportarDoDataLake.tsx:292-297`) lê via `getPermissionValor(key)`. Banco não tem validação; UI de “Por Perfil” / “Comparar” não mostra valor (§4.8).

### 6.9 `masterOnly` no registry — visibilidade fora do RBAC

`PermissionModule.masterOnly` em `PermissionRegistry.ts:11-18` + filtro em `getGroupedPermissions(isMaster)`. É uma **regra de visibilidade no UI** baseada em `useMfaMaster()` — distinta de `tipo_acesso = 'Master'`. Cria um terceiro eixo de gating (além de perfil e flag).

### 6.10 Cache em memória, sem realtime

`useUserAccessType.ts` único `useEffect(..., [user])`. Sem `supabase.channel(...)`, sem invalidação. `ControleAcessos.tsx` aplica update otimista local, mas só no admin que está editando; outros usuários não escutam.

---

## 7. Mapeamento para `Escopo > Recurso > Ação`

Tradução **descritiva** do modelo atual para o formato alvo. Onde uma flag não tem o eixo claramente, a coluna fica `n/a` e é registrada como lacuna em §7.5.

### 7.1 Definição dos eixos

- **Escopo (`scope`):** o domínio sobre o qual a ação se aplica.
  - Hoje, escopo possível em código: `global` (todas as empresas), `empresa` (uma empresa via `CompanyContext.activeCompanyId`), `departamento_real` (não usado no RBAC), `perfil` (`tipo_acesso`, dimensão de **sujeito**, não de objeto), `proprio` (ownership do registro), `recurso_especifico` (ex.: cadeira `X`, vault entry `Y`).
  - **Observação:** o modelo atual avalia tudo no escopo `global`. `empresa`, `proprio` e `recurso_especifico` aparecem em RLS de outras tabelas (`prospeccoes`, `mfa_account_access`, `whatsapp_templates`, etc.) mas **não no RBAC central**.

- **Recurso (`resource`):** entidade de domínio.
  - Recursos canônicos identificáveis hoje: `eventos_prospeccao`, `prospeccoes`, `contatos`, `clientes`, `whatsapp_templates`, `agentes_ia`, `controle_agentes`, `usuarios`, `empresas`, `kanban`, `atendimentos`, `vendas`, `recepcao_visitas`, `convites`, `pool_clientes_externos`, `ia_ligacao`, `disparos`, `relatorios`, `resultados`, `personas`, `gatilhos`, `apis`, `webhooks`, `configuracoes`, `pos_vendas`, `algoritmos`, `cadeiras`, `login_domains`, `notificacoes`, `minha_conta`, `ajuda`, `administracao_menu`, `controle_acessos`, `authenticator/mfa.vault`, `mfa.audit_logs`, `opt_out_global`, `external_optout`, `governanca_dados`, `valor_dias_max` (config interna).
  - Várias flags atuais usam nome de **UI** (`canAccess*`) e não de **recurso**, criando ambiguidade.

- **Ação (`action`):** verbos canônicos.
  - Hoje no registry: `visualizar`, `criar`, `editar`, `excluir`, `ativar_desativar`, `administrar`, `executar`.
  - `administrar` e `executar` são **catch-alls** que agregam várias ações concretas (dispatch, approve, configure, assign, sync).

### 7.2 Tradução das flags atuais

Tabela parcial (visão estrutural; tabela completa flag-a-flag fica no Anexo A).

| Flag                              | Escopo (atual)   | Recurso                         | Ação canônica                    | Observação / granularidade perdida                                                                 |
| --------------------------------- | ---------------- | ------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `canViewEventos`                  | global           | eventos_prospeccao              | read                             | Não filtra por empresa nem por ownership.                                                          |
| `canCreateEventos`                | global           | eventos_prospeccao              | create                           | Sem limite por empresa do usuário.                                                                 |
| `canEditEventos`                  | global           | eventos_prospeccao              | update                           | Não distingue editar próprio vs alheio.                                                            |
| `canDeleteEventos`                | global           | eventos_prospeccao              | delete                           | Mesma observação; risco alto.                                                                      |
| `canManageEventos`                | global           | eventos_prospeccao              | **manage (catch-all)**           | Engloba C/U/D/dispatch — granularidade perdida.                                                    |
| `canManageEvents`                 | global           | eventos_prospeccao              | manage (legacy)                  | Coexiste com `canManageEventos`; dois nomes, mesmo recurso.                                        |
| `canDispararEventos`              | global           | disparos / eventos              | dispatch                         | Sem distinção por canal (wpp/voice).                                                               |
| `canRedispararEventos`            | global           | disparos                        | redispatch                       | Idem.                                                                                              |
| `canAprovarCampanhas`             | global           | disparos                        | approve                          | Sem escopo por empresa.                                                                            |
| `canProgramarCampanhas`           | global           | disparos                        | schedule                         | Idem.                                                                                              |
| `canViewClientes`                 | global           | clientes                        | read                             | True para 12/12 perfis; sem escopo.                                                                |
| `canAddClientes`                  | global           | clientes                        | create                           | Sem escopo.                                                                                        |
| `canDeleteContatos`               | global           | contatos                        | delete                           | Sem distinção próprio/alheio.                                                                      |
| `canImportPool` (`+valor`)        | global           | pool_clientes_externos          | import (com `dias_max`)          | Parâmetro = constraint do RBAC, hoje em `valor jsonb` sem validação server-side.                   |
| `canImportPoolFull`               | global           | pool_clientes_externos          | import.full (com `dias_max`)     | Idem.                                                                                              |
| `canImportPoolReadOnly`           | global           | pool_clientes_externos          | import.ro (`dias_max`, `eventos_permitidos`) | Constraint `eventos_permitidos ∈ {todos,futuros}` — controle do recurso já existe, parcial. |
| `canManageUsers`                  | global           | usuarios                        | manage                           | Catch-all; sem escopo por empresa.                                                                 |
| `canCreateUsers`/`canEditUsers`/`canDeleteUsers` | global | usuarios                  | create/update/delete             | Gestores podem criar globalmente; nenhum filtro de empresa.                                        |
| `canAccessControleAcessos`        | global           | controle_acessos (auto)         | manage                           | Recurso é o próprio sistema de permissões; risco de lock-out por auto-revogação.                   |
| `canAccessAdministracao`          | global           | administracao_menu              | read                             | Recurso = item de menu, não entidade de domínio.                                                   |
| `canManageEmpresas`/`canViewEmpresas`/`canEditEmpresas` | global | empresas              | manage/read/update               | Sem escopo `proprio` (proprietário só de uma empresa).                                             |
| `canAccessRecepcao`               | global           | recepcao                        | read                             | UI-only.                                                                                           |
| `canReadQRCode`                   | global           | recepcao_visitas                | execute                          | Sem escopo de loja.                                                                                |
| `canDeleteRecepcaoVisita`         | global           | recepcao_visitas                | delete                           | Sem distinção próprio/alheio.                                                                      |
| `canAccessAgentesIA`              | global (+bypass) | agentes_ia                      | read                             | Bypass §6.2; impossível desligar para depto TI.                                                    |
| `canManageInstancias`             | global           | agentes_ia.instancias           | manage                           | Catch-all.                                                                                         |
| `canViewVariaveis`/`canEditVariaveis` | global       | agentes_ia.variaveis            | read/update                      | n/a.                                                                                               |
| `canManageCadencias`              | global           | agentes_ia.cadencias            | manage                           | Catch-all.                                                                                         |
| `canViewControleAgentes` (+CRUD)  | global           | controle_agentes                | read/create/update/delete/toggle | OK em ações; sem escopo.                                                                           |
| `canViewTemplates` (+CRUD)        | global           | whatsapp_templates              | read/create/update/delete        | RLS real do recurso usa `empresa_id`; RBAC ignora.                                                 |
| `canCreateIALigacao`              | global           | ia_ligacao                      | create                           | n/a.                                                                                               |
| `canDispararIALigacao`            | global           | ia_ligacao                      | dispatch                         | Default: só Admin/Master.                                                                          |
| `canToggleIALigacao`              | global           | ia_ligacao                      | toggle                           | n/a.                                                                                               |
| `canViewIALigacaoLogs`            | global           | ia_ligacao.logs                 | read                             | n/a.                                                                                               |
| `canAccessOptOutGlobal`           | global           | opt_out_global                  | manage                           | n/a.                                                                                               |
| `canRegisterExternalOptOut`       | global           | external_optout                 | execute (regulatório)            | Sem escopo de loja/marca; alto impacto regulatório.                                                |
| `canGovernancaDados`              | global           | governanca_dados                | manage                           | Recurso “meta”; pouco definido.                                                                    |
| `canValidarImportacao`            | global           | base_contatos.importacoes       | approve                          | n/a.                                                                                               |
| `canAccessKanban`/`canEditAtendimentos`/`canDeleteAtendimentos` | global | atendimentos       | read/update/delete               | RLS real usa visibilidade por equipe; RBAC ignora.                                                 |
| `canViewProspeccao`/`canCreate*`/`canEdit*`/`canDelete*` | global | prospeccoes                 | read/create/update/delete        | Visibilidade real depende de equipe (`prospeccao_equipe_membros`).                                 |
| `canManageProspeccaoEquipes`      | global           | prospeccoes.equipes             | manage                           | Catch-all.                                                                                         |
| `canViewVendas`/`canCreateVendas`/`canEditVendas`/`canDeleteVendas` | global | vendas                  | read/create/update/delete        | n/a.                                                                                               |
| `canViewAuthenticator` (+manage/assign/audit) | global (masterOnly UI) | mfa.vault                | read/manage/assign/audit         | Visibilidade extra via `useMfaMaster` (§6.9). RLS real escopa por `mfa_account_access`.            |
| `canUseStoreSeat`                 | empresa (loja)   | cadeiras                        | execute (claim)                  | Único caso onde escopo `empresa` aparece naturalmente (loja ativa).                                |
| `canManageStoreSeats`             | global           | cadeiras                        | manage                           | n/a.                                                                                               |
| `canManageLoginDomains`           | global           | allowed_login_domains           | manage                           | n/a.                                                                                               |
| `canManagePosVendasCadencia` etc. | global           | pos_vendas.*                    | manage                           | **Órfã** (rotas usam `canAccessPosVendas`).                                                        |
| `canCreateGatilhos`/Edit/Delete   | global           | gatilhos                        | create/update/delete             | **Órfã** (rota usa `canAccessGatilhos`).                                                           |
| `canManageWebhooks`               | global           | webhooks                        | manage                           | **Órfã**.                                                                                          |
| `canManageDocumentos`             | global           | documentos                      | manage                           | **Órfã**.                                                                                          |
| `canManageProdutos`               | global           | produtos                        | manage                           | **Órfã**.                                                                                          |
| `canAccessAlgoritmos*` (Compra/Venda/PosVendas) | global | algoritmos                  | read                             | Apenas “em construção”; recurso real ainda não existe.                                             |
| `canAccessNotificacoes`/`canAccessMinhaConta`/`canAccessAjuda` | global | navegacao              | read                             | Recurso = item de menu.                                                                            |
| `canAccessRelatorios`             | global           | relatorios                      | read                             | n/a.                                                                                               |
| `canAccessResultados`/`canViewMetricas`/`canSyncResultados` | global | resultados                | read/read/execute                | Sub-resultados (whatsapp, ligacao, ranking, etc.) usam a mesma flag.                               |
| `canAccessConfiguracoes`/`canEditConfiguracoes` | global | configuracoes               | read/update                      | Recurso engloba sub-abas; sem granularidade.                                                       |
| `canManageDepartamentos`/Motivos/Origens/Temperaturas/WhatsApp/Mensagens | global | configuracoes.*    | manage                           | n/a.                                                                                               |
| `canAccessPersonas`/`canCreate*`/`canEdit*`/`canDelete*` | global | personas                    | read/create/update/delete        | n/a.                                                                                               |
| `canAccessAPIs`/`canManageAPIs`/`canTestAPIs` | global   | apis                            | read/manage/execute              | n/a.                                                                                               |

### 7.3 Parametrizações já existentes (`hasValor`) — viram constraints

| Flag                       | Constraint declarada (em `valorSchema`)                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `canImportPool`            | `dias_max: number\|null` (nullable = "Ilimitado", step 30, min 1)                                                                |
| `canImportPoolFull`        | `dias_max` (igual)                                                                                                               |
| `canImportPoolReadOnly`    | `dias_max` + `eventos_permitidos: 'todos'\|'futuros'`                                                                            |

Esses parâmetros não são apenas “configurações”; eles **limitam o escopo da ação** (recurso = `pool_clientes_externos`, ação = `import`, **constraint** = janela temporal e conjunto de eventos elegíveis). Hoje vivem em `valor jsonb` sem validação no banco.

### 7.4 Bypasses e exceções (precisam virar regras explícitas no modelo)

| Bypass / Exceção                              | Onde                                                              | Efeito                                                          |
| --------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Force-true para `Master`                      | `useUserAccessType.ts:67-71`                                      | Master vê/edita tudo, independente do banco.                    |
| Bypass depto TI em `canAccessAgentesIA`       | `useUserAccessType.ts:138`                                        | Depto TI Admin/TI vê módulo mesmo com flag desligada.           |
| `AdminProtectedRoute` (rota dedicada)         | `src/components/AdminProtectedRoute.tsx`                          | Rotas usam `isAdmin` direto, ignoram `permissions[]`.           |
| `TIAdminProtectedRoute`                       | `src/components/TIAdminProtectedRoute.tsx`                        | Carrega o bypass §6.2 transitivamente.                          |
| `GestorProtectedRoute`                        | `src/components/GestorProtectedRoute.tsx`                         | Outro caminho de gating por perfil.                             |
| `masterOnly` por módulo                       | `PermissionRegistry.ts:11-18` + `getGroupedPermissions(isMaster)` | Visibilidade UI extra (`useMfaMaster`).                         |
| RLS de `departamento_permissoes`              | migration 20260608…                                               | Editor é `Administrador/Master/TI` via `tipo_acesso`, não flag. |
| Sidebar com composições ad-hoc (`a && b`)     | `AppSidebar.tsx:155-165`                                          | `canSeeClientes = canViewClientes && canAddClientes` etc.       |
| Composições ad-hoc em `Administracao.tsx:49`  | `if (p("canGovernancaDados") && !p("canAccessAdminConfig") && !p("canManageUsers"))` | Regra composta hardcoded.                          |

### 7.5 Lacunas de granularidade evidentes

1. **Ações fundidas em catch-all:** `canManageEventos`, `canManageInstancias`, `canManageEmpresas`, `canManageWebhooks`, `canManageCadencias`, `canManagePosVendas*`, `canManageProspeccaoEquipes`, `canManageDepartamentos/Motivos/...`. Cada `manage` agrega read+create+update+delete+configure.
2. **Duplicidade legacy de `manage`:** `canManageEvents` (legacy) coexiste com `canManageEventos`; ambos resolvem para `eventos`.
3. **Escopo `empresa` ausente** em quase tudo. `CompanyContext.activeCompanyId` existe (memória `Active Context`) e várias RLS reais filtram por empresa (`whatsapp_templates`, `prospeccoes`, `mfa_account_access`), mas o RBAC central trata tudo como `global`.
4. **Escopo `proprio` ausente.** Delete/edit não distingue dono do registro. Caso típico: `canDeleteEventos = isAdminOrTI` — gestor sem TI não consegue excluir nem o evento que criou.
5. **Escopo `departamento_real` só como bypass** (§6.2), não como dimensão de avaliação.
6. **Recursos implícitos / nomes de UI:** `canAccessAdministracao`, `canAccessNotificacoes`, `canAccessMinhaConta`, `canAccessAjuda`, `canAccessResultados`, `canAccessAPIs` referenciam **telas**, não entidades. Dificulta a tradução `(recurso, ação)` porque a tela pode agregar múltiplos recursos (ex.: `/resultados/*`).
7. **Flags órfãs** (`canManageWebhooks`, pos-vendas/cadencia/templates/lojas, `canCreate/Edit/DeleteGatilhos`, `canManageDocumentos`, `canManageProdutos`, algoritmos enquanto “em construção”) — não têm recurso real consumidor.
8. **Ações duplicadas entre flag e guard de rota dedicado:** `/administracao` é protegido por `PermissionProtectedRoute permissionKey=["canAccessAdministracao","canViewAuthenticator"]`, mas vários sub-itens também são checados por `AdminProtectedRoute` (`isAdmin`) ou `TIAdminProtectedRoute` (`canAccessAgentesIA` com bypass). Mesma rota tem dois critérios simultâneos vivendo em camadas diferentes.
9. **Constraints (parâmetros) tratados como dado livre.** `valor jsonb` carrega `dias_max`, `eventos_permitidos` — são literalmente *attributes* do RBAC, mas sem schema-DB nem validação.
10. **Falta de status por flag** (`stable | orphan | deprecated | masterOnly | bypass`) — sem isso, contadores e UX (§4.2, §4.13) ficam enganosos.
11. **Dois estilos de leitura** (`permissions[key]` vs flag nomeada) — não há fonte única de verdade para o consumidor.
12. **`tipo_acesso` é simultaneamente perfil RBAC e dimensão de RLS** (`get_current_user_access_type()` no banco). Mudar a forma de avaliar permissões implica mudar políticas RLS de outras tabelas.

---

## 8. Riscos consolidados do modelo atual

| # | Risco                                                                          | Evidência                                  | Tipo                  |
| - | ------------------------------------------------------------------------------ | ------------------------------------------ | --------------------- |
| 1 | Lock-out de administradores                                                    | §3.4, §6.4 (RLS independente da flag)      | Operacional crítico   |
| 2 | Bypass invisível por depto TI                                                  | §3.3, §6.2                                 | Segurança             |
| 3 | UI × runtime divergentes (Master)                                              | §3.1, §3.9, §6.1                           | Confiabilidade        |
| 4 | Auditoria zero                                                                 | §3.6, §6.7                                 | Compliance            |
| 5 | Falsa sensação de controle por flags órfãs / contadores                        | §3.2, §3.13, §6.5, §6.6                    | Governança            |
| 6 | Granularidade insuficiente para multi-tenant real                              | §6.5, §7.5 (3,4)                           | Segurança / produto   |
| 7 | Configurações críticas (`valor jsonb`) sem validação server-side               | §3.10, §6.8                                | Confiabilidade / regulatório |
| 8 | Latência de propagação (sem realtime)                                          | §3.11, §6.10                               | Operacional           |
| 9 | Ações destrutivas sem rede (Clonar perfil + toggles críticos)                  | §3.7                                       | Operacional           |
| 10| Três caminhos de autorização coexistindo (flag, AdminProtected, TIAdminProtected) | §6.3, §7.4                              | Manutenibilidade      |
| 11| `tipo_acesso` acoplado a RLS de várias tabelas                                 | §6.4, §7.5 (12)                            | Arquitetural          |

---

## 9. Checklist de pontos a endereçar (sem solução)

Lista única, numerada, para ser endereçada pela proposta de RBAC fina. Cada item já mapeia §4.x correlato.

1. [ ] Definir politica explícita para o perfil `Master` (UI + runtime + UI counters). §4.1, §4.9
2. [ ] Decidir destino das flags órfãs: remover, deprecar com marcador, ou conectar a um recurso real. §4.2
3. [ ] Transformar o bypass de depto TI em regra explícita (escopo `departamento_real`) ou eliminá-lo. §4.3
4. [ ] Bloquear caminhos que levam a lock-out (auto-revogação de perfil e auto-revogação de usuário). §4.4
5. [ ] Rever UX do filtro “por perfil” em Por Módulo. §4.5
6. [ ] Adicionar `updated_by`, `created_at`, `created_by` e tabela de logs em `departamento_permissoes`. §4.6
7. [ ] Definir camada de confirmação para ações destrutivas (Clonar + toggles de flags marcadas como críticas). §4.7
8. [ ] Expor edição de `valor jsonb` em todas as abas relevantes. §4.8
9. [ ] Adicionar contrato server-side (CHECK/JSON Schema/RPC validador) para o `valor jsonb`. §4.10
10. [ ] Invalidação realtime das permissões (postgres_changes + invalidação de cache do hook). §4.11
11. [ ] Adicionar busca por `key` técnica no Registry/UI. §4.12
12. [ ] Cruzar contadores com status real da flag (stable/orphan/deprecated). §4.13
13. [ ] Definir e adotar eixo **Escopo** no RBAC: `global | empresa | departamento_real | proprio | recurso_especifico`. §7.5 (3,4,5)
14. [ ] Definir conjunto canônico de **Recursos** de domínio (substituindo nomes de tela). §7.5 (6)
15. [ ] Definir conjunto canônico de **Ações** (substituindo `manage`/`executar` catch-all). §7.5 (1,2)
16. [ ] Modelar parametrização (`dias_max`, `eventos_permitidos`, ...) como **constraints** de primeira classe. §7.3, §4.10
17. [ ] Unificar os caminhos de autorização (atualmente `PermissionProtectedRoute`, `AdminProtectedRoute`, `TIAdminProtectedRoute`, `GestorProtectedRoute`, bypasses no hook). §6.3, §7.4
18. [ ] Definir relação entre `tipo_acesso` (usado em RLS hoje) e o futuro modelo RBAC, evitando duplicação. §6.4, §7.5 (12)
19. [ ] Decidir fonte da verdade dos defaults (código vs banco). §6.5
20. [ ] Eliminar a duplicação entre `permissions[key]` e flags nomeadas. §6.6
21. [ ] Documentar/normalizar a regra do `masterOnly` (visibilidade extra via `useMfaMaster`). §6.9

---

## 10. Anexos

### Anexo A — Catálogo de flags por módulo (mapa para `Escopo > Recurso > Ação`)

Coluna “Consumidor” = `sim` quando há `permissions["key"]` / `p("key")` / `permissionKey="key"` / flag nomeada usada em alguma rota ou componente; `não` quando não há; `parcial` quando aparece apenas em flag nomeada do hook sem consumidor real, ou apenas no sidebar/index sem efeito além do menu.

| Módulo                     | Flag                                  | Escopo atual | Recurso (canônico)            | Ação canônica      | Consumidor |
| -------------------------- | ------------------------------------- | ------------ | ----------------------------- | ------------------ | ---------- |
| Authenticator              | canViewAuthenticator                  | global+UI    | mfa.vault                     | read               | sim        |
| Authenticator              | canManageAuthenticator                | global+UI    | mfa.vault                     | manage             | sim        |
| Authenticator              | canAssignAuthenticator                | global+UI    | mfa.vault                     | assign             | sim        |
| Authenticator              | canViewAuditLogs                      | global+UI    | mfa.audit_logs                | read               | sim        |
| Controle de Agentes        | canViewControleAgentes                | global       | controle_agentes              | read               | sim (rota) |
| Controle de Agentes        | canCreateControleAgentes              | global       | controle_agentes              | create             | parcial    |
| Controle de Agentes        | canEditControleAgentes                | global       | controle_agentes              | update             | parcial    |
| Controle de Agentes        | canDeleteControleAgentes              | global       | controle_agentes              | delete             | parcial    |
| Controle de Agentes        | canToggleControleAgentes              | global       | controle_agentes              | toggle             | parcial    |
| Agentes IA                 | canAccessAgentesIA                    | global+bypass| agentes_ia                    | read               | sim        |
| Agentes IA                 | canCreateAgentesIA / canEdit / canDelete | global    | agentes_ia                    | create/update/delete | parcial  |
| Agentes IA                 | canManageInstancias                   | global       | agentes_ia.instancias         | manage             | sim (rota) |
| Agentes IA                 | canViewVariaveis / canEditVariaveis   | global       | agentes_ia.variaveis          | read/update        | parcial    |
| Agentes IA                 | canManageCadencias / Followups / Integracoes | global| agentes_ia.*                  | manage             | parcial    |
| Templates                  | canViewTemplates / Create/Edit/Delete | global       | whatsapp_templates            | read/create/update/delete | sim (rota+componentes) |
| Eventos                    | canViewEventos                        | global       | eventos_prospeccao            | read               | sim        |
| Eventos                    | canCreateEventos / Edit / Delete      | global       | eventos_prospeccao            | create/update/delete | sim       |
| Eventos                    | canManageEvents / canManageEventos    | global       | eventos_prospeccao            | manage (legacy+novo) | sim       |
| IA Ligação                 | canCreateIALigacao                    | global       | ia_ligacao                    | create             | sim        |
| IA Ligação                 | canDispararIALigacao                  | global       | ia_ligacao                    | dispatch           | sim        |
| IA Ligação                 | canToggleIALigacao                    | global       | ia_ligacao                    | toggle             | sim        |
| IA Ligação                 | canViewIALigacaoLogs                  | global       | ia_ligacao.logs               | read               | parcial    |
| Disparos                   | canDispararEventos / Redisparar       | global       | disparos                      | dispatch/redispatch | sim       |
| Disparos                   | canAprovarCampanhas / Programar       | global       | disparos                      | approve/schedule   | sim        |
| Base / Contatos            | canViewClientes / Add / Edit / Delete | global       | clientes                      | read/create/update/delete | sim   |
| Base / Contatos            | canImportClientes / canUploadBase     | global       | base.importacoes              | execute            | sim        |
| Base / Contatos            | canEditContatos / canDeleteContatos   | global       | contatos                      | update/delete      | sim        |
| Base / Contatos            | canValidarImportacao                  | global       | base.importacoes              | approve            | sim        |
| Base / Contatos            | canGovernancaDados                    | global       | governanca_dados              | manage             | sim        |
| Base / Contatos            | canAccessOptOutGlobal                 | global       | opt_out_global                | manage             | sim        |
| Base / Contatos            | canRegisterExternalOptOut             | global       | external_optout               | execute (regulatório) | sim     |
| Base / Contatos            | canImportPool (+valor)                | global       | pool_clientes_externos        | import (`dias_max`)| sim        |
| Base / Contatos            | canImportPoolFull (+valor)            | global       | pool_clientes_externos        | import.full        | sim        |
| Base / Contatos            | canImportPoolReadOnly (+valor)        | global       | pool_clientes_externos        | import.ro (`dias_max`, `eventos_permitidos`) | sim |
| Recepção                   | canAccessRecepcao                     | global       | recepcao                      | read               | sim        |
| Recepção                   | canReadQRCode                         | global       | recepcao_visitas              | execute            | sim        |
| Recepção                   | canDeleteRecepcaoVisita               | global       | recepcao_visitas              | delete             | sim        |
| Convites                   | canGenerateInvites                    | global       | convites                      | execute            | sim        |
| Kanban                     | canAccessKanban / Edit / Delete       | global       | atendimentos                  | read/update/delete | sim        |
| Prospecção                 | canViewProspeccao / Create/Edit/Delete| global       | prospeccoes                   | read/CUD           | sim        |
| Prospecção                 | canManageProspeccaoEquipes            | global       | prospeccoes.equipes           | manage             | sim        |
| Vendas                     | canViewVendas / Create / Edit / Delete| global       | vendas                        | read/CUD           | sim        |
| Usuários                   | canManageUsers / Create / Edit / Delete | global     | usuarios                      | manage/CUD         | sim        |
| Usuários                   | canAccessAdminConfig                  | global       | administracao.config          | read               | sim        |
| Usuários                   | canAccessAdministracao                | global       | administracao_menu            | read               | sim        |
| Usuários                   | canAccessControleAcessos              | global       | controle_acessos              | manage             | sim        |
| Empresas                   | canManageEmpresas / View / Edit       | global       | empresas                      | manage/read/update | sim        |
| Financeiro                 | canAccessFinancialReports             | global       | financeiro.relatorios         | read               | sim        |
| Financeiro                 | canViewDashboard                      | global       | financeiro.dashboard          | read               | sim        |
| Financeiro                 | canExportRelatorios                   | global       | financeiro.relatorios         | export             | parcial    |
| Resultados                 | canAccessResultados / canViewMetricas | global       | resultados                    | read               | sim        |
| Resultados                 | canSyncResultados                     | global       | resultados                    | execute            | sim        |
| Configurações              | canAccessConfiguracoes / Edit         | global       | configuracoes                 | read/update        | sim        |
| Configurações              | canManageDepartamentos / Motivos / Origens / Temperaturas / WhatsApp / Mensagens | global | configuracoes.* | manage | sim |
| Configurações              | canManageDocumentos                   | global       | documentos                    | manage             | **não**    |
| Configurações              | canManageProdutos                     | global       | produtos                      | manage             | **não**    |
| Personas / Gatilhos        | canAccessPersonas / Create / Edit / Delete | global  | personas                      | read/CUD           | sim        |
| Personas / Gatilhos        | canAccessGatilhos                     | global       | gatilhos                      | read               | sim (rota) |
| Personas / Gatilhos        | canCreateGatilhos / Edit / Delete     | global       | gatilhos                      | create/update/delete | **não**  |
| Integrações / APIs         | canAccessAPIs / Manage / Test         | global       | apis                          | read/manage/execute| sim        |
| Integrações / APIs         | canManageWebhooks                     | global       | webhooks                      | manage             | **não**    |
| Navegação                  | canAccessNotificacoes / MinhaConta / Ajuda | global  | navegacao.*                   | read               | sim        |
| Navegação                  | canAccessRelatorios                   | global       | relatorios                    | read               | sim        |
| Pós-Vendas                 | canAccessPosVendas                    | global       | pos_vendas                    | read               | sim        |
| Pós-Vendas                 | canManagePosVendasTemplates / Lojas / Cadencia | global | pos_vendas.*               | manage             | **não**    |
| Algoritmos                 | canAccessAlgoritmosCompra / Venda / PosVendas | global | algoritmos.*                | read               | sim (rota; recurso ainda “em construção”) |
| Cadeiras                   | canUseStoreSeat                       | empresa (loja)| cadeiras                     | execute (claim)    | sim        |
| Cadeiras                   | canManageStoreSeats                   | global       | cadeiras                      | manage             | sim        |
| Cadeiras                   | canManageLoginDomains                 | global       | allowed_login_domains         | manage             | sim        |

> A coluna **Consumidor** acima foi inferida a partir de `rg -n 'permissions\\[|p\\(\"can|permissionKey='`. Antes da fase de solução, vale rodar o grep formal por chave para fechar 100% (Anexo B do plano).

### Anexo B — Tratamento por `TIPOS_ACESSO`

| Perfil               | Trata como Admin? | Bypass dedicado | Force-true | Observações                                                              |
| -------------------- | ----------------- | --------------- | ---------- | ------------------------------------------------------------------------ |
| SDR                  | não               | —               | não        | Vê pouca coisa por default.                                              |
| Vendedor             | não               | —               | não        | Idem.                                                                    |
| CRM                  | não (mas amplo)   | —               | não        | Recebe muitas flags por OR explícito nos defaults (templates, eventos, governança, opt-out). |
| Recepcionista        | não               | —               | não        | Vários `defaults = !isRecepcionista` — restrição negativa.               |
| Gerente de Leads     | parcial           | —               | não        | Composição via `isGerente`. Cria usuários por default.                   |
| Gerente de Loja      | parcial           | —               | não        | Idem.                                                                    |
| Coordenadora de Leads| parcial           | —               | não        | Idem.                                                                    |
| Diretor              | parcial           | —               | não        | Acesso a financeiro.                                                     |
| TI                   | parcial           | **§6.2**        | não        | Bypass invisível em `canAccessAgentesIA` quando `depto = TI`.            |
| Administrador        | sim (`isAdmin`)   | `AdminProtectedRoute` | não  | Pode se auto-revogar `canAccessControleAcessos` (§4.4).                  |
| Proprietário         | não               | —               | não        | Acesso a financeiro/empresas (read).                                     |
| Master               | sim               | **§6.1**        | **sim** (client) | UI não reflete; banco aceita overrides irrelevantes.                |

### Anexo C — Mapa de rotas vs flag exigida (extrato `src/App.tsx`)

Lista parcial relevante para o RBAC. Linhas referenciadas pelo grep:

| Rota                                                    | Flag exigida (`permissionKey`)                                                | Observação                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| `/clientes`                                             | `canViewClientes`                                                             | —                                       |
| `/notificacoes`                                         | `canAccessNotificacoes`                                                       | —                                       |
| `/personas`                                             | `canAccessPersonas`                                                           | —                                       |
| `/prospeccao` (+ `/eventos`, `/atendimento`)            | `canViewProspeccao`                                                           | —                                       |
| `/prospeccao/recepcao`                                  | `canAccessRecepcao`                                                           | —                                       |
| `/prospeccao/vendas`                                    | `canViewVendas`                                                               | —                                       |
| `/prospeccao/templates`                                 | `canViewTemplates`                                                            | —                                       |
| `/resultados/*` (whatsapp/ligacao/ranking/produtos/...)| `canAccessResultados` (mesma flag para todos)                                 | Falta granularidade por sub-recurso.    |
| `/relatorios`                                           | `canAccessRelatorios`                                                         | —                                       |
| `/configuracoes`                                        | `canAccessConfiguracoes`                                                      | Sub-abas sem flag própria.              |
| `/cadeiras`                                             | `[canUseStoreSeat, canManageStoreSeats, canManageLoginDomains]`              | OR explícito (lista).                   |
| `/gatilhos`                                             | `canAccessGatilhos`                                                           | `canCreate/Edit/DeleteGatilhos` órfãs.  |
| `/pos-vendas/*` (todos os sub-itens)                    | `canAccessPosVendas`                                                          | `canManagePosVendas*` órfãs.            |
| `/algoritmos/compra/*`                                  | `canAccessAlgoritmosCompra`                                                   | Recurso em construção.                  |
| `/algoritmos/venda/*`                                   | `canAccessAlgoritmosVenda`                                                    | Idem.                                   |
| `/algoritmos/pos-vendas/*`                              | `canAccessAlgoritmosPosVendas`                                                | Idem.                                   |
| `/agentes-ia`                                           | `canAccessAgentesIA` (carrega bypass §6.2)                                    | —                                       |
| `/agentes-ia/instancias`                                | `canManageInstancias`                                                         | —                                       |
| `/agentes-ia/performance`                               | `canAccessAgentesIA`                                                          | —                                       |
| `/administracao` / `/admin`                             | `[canAccessAdministracao, canViewAuthenticator]`                              | OR — Master/MFA tem caminho alternativo.|
| `/administracao/empresas`                               | `canManageEmpresas`                                                           | —                                       |
| `/administracao/acessos` / `/admin/acessos`             | `[canManageUsers, canCreateUsers, canEditUsers, canDeleteUsers]`              | OR de 4 flags.                          |
| `/administracao/agentes`                                | `canAccessAgentesIA`                                                          | Bypass.                                 |
| `/administracao/agentes/controle`                       | `[canViewControleAgentes, canAccessAgentesIA]`                                | OR.                                     |
| `/administracao/agentes/visao-geral`                    | `canAccessAgentesIA`                                                          | —                                       |
| `/administracao/campos`                                 | `canAccessAdminConfig`                                                        | —                                       |
| `/administracao/apis`                                   | `canAccessAPIs`                                                               | —                                       |
| `/administracao/test-apis`                              | `canTestAPIs`                                                                 | —                                       |
| `/administracao/controle-acessos`                       | `canAccessControleAcessos`                                                    | Lock-out potencial (§4.4).              |

---

## 11. O que NÃO está neste documento (lembrete)

- Proposta de schema RBAC novo.
- Proposta de migrations / RLS novas.
- Proposta de refactor do `useUserAccessType` ou `PermissionRegistry`.
- Política de deprecação de flags órfãs.
- Modelagem de constraints (parâmetros) como objeto de primeira classe.
- Estratégia de coexistência entre `tipo_acesso` (RLS) e o futuro modelo.

Esses itens são entregáveis da próxima fase, sobre a base de evidências acima.