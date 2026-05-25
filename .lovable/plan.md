## Objetivo

Gerar um documento markdown abrangente em `/mnt/documents/permissoes-niveis.md` que cubra **todos os módulos** do `PermissionRegistry`, seguindo a mesma premissa do `entra-dados-niveis.md`:

Para cada módulo, explicar:
1. **Nível de acesso** — quais flags do `PermissionRegistry` controlam, defaults por `tipo_acesso`, overrides via `departamento_permissoes`.
2. **Nível de visualização** — onde aparece (sidebar, página, ações, botões), o que cada role enxerga.
3. **Nível de existência (multi-tenant)** — como o módulo se comporta entre empresas/spaces: por empresa (`empresa_id` + RLS), global compartilhado, ou híbrido. Quais tabelas, quais políticas, como o `CompanyContext.activeCompany` afeta.

## Estrutura do documento

1. **Visão geral do sistema de permissões**
   - Fluxo: `auth` → `profiles.tipo_acesso` → `PermissionRegistry` (defaults) → `departamento_permissoes` (overrides) → `useUserAccessType` → `PermissionProtectedRoute` / checks na UI.
   - Hierarquia de 12 níveis de `tipo_acesso` + regra Master = superadmin.
   - Diagrama Mermaid do fluxo.

2. **Modelos de existência multi-tenant (referência)**
   - Modelo A — Global, Modelo B — Por empresa, Modelo C — Híbrido (resumo, com link ao doc Entra Dados).
   - Como `EMPRESA ADMIN` (sandbox), `user_can_access_empresa()` e `prospeccao_equipe_membros` se encaixam.

3. **Catálogo por módulo** — uma seção por módulo do `PERMISSION_MODULES`, cada uma com tabela de flags + 3 níveis:
   - Authenticator (MFA) — masterOnly, global restrito
   - Controle de Agentes — por empresa
   - Agentes IA / Instâncias — por empresa, com `agente_empresas`
   - Templates (WhatsApp) — compartilhado via `id_meta`
   - Eventos / Prospecção — por empresa, com equipes
   - IA Ligação — por empresa, isolada por `crm_id` + telefone
   - Disparos — por empresa, com aprovação
   - Base / Contatos (inclui Pool/DataLake, Opt-Out Global) — misto: contatos por empresa, opt-out global
   - Recepção — por empresa (QR scan)
   - Convites / QR Codes — por evento/empresa
   - Kanban / Atendimentos — por empresa + visibilidade SDR
   - Prospecção — por empresa + `prospeccao_equipe_membros`
   - Vendas — por empresa
   - Usuários / Acessos — global restrito (Admin/TI/Master)
   - Empresas / Lojas — global (sync de `user_empresas`)
   - Financeiro / Relatórios — agregado cross-company para gestão
   - Resultados — agregado cross-company
   - Configurações — global com override `per_empresa`
   - Personas / Gatilhos — por empresa
   - Integrações / APIs — global restrito
   - Navegação / Menus — perfil-only (não multi-tenant)
   - Pós-Vendas (Paty) — por empresa
   - Algoritmos — em construção
   - Entra Dados (novo) — referência ao doc dedicado

4. **Diagramas Mermaid**
   - Fluxo permissão→UI
   - Matriz módulo × modelo de existência
   - Decisão "qual modelo escolher para um novo módulo"

5. **Como adicionar um novo módulo** (checklist)
   - Passos no `PermissionRegistry`, `getDefaultPermissions`, `useUserAccessType`, `PermissionProtectedRoute`, decisão de modelo multi-tenant, RLS.

## Detalhes técnicos

- Fontes lidas: `PermissionRegistry.ts`, `useUserAccessType.ts`, `PermissionProtectedRoute.ts`, memórias do projeto (`access-hierarchy-levels`, `prospeccao-equipe-membros`, `whatsapp-template-sharing`, `quarentena/*`, `mfa/*`, `sync-empresas-strategy`, `logica-contexto-empresa-ativa`, `relatorio-leads-convidados`).
- Cada flag listada com: `key`, `action`, default por role (resumido), módulo, descrição. Onde aplicável: `hasValor`/`valorSchema` (ex: `canImportPool*` com `dias_max`).
- Para o nível de existência, cada módulo recebe um rótulo: **Global**, **Por empresa**, **Híbrido**, **Compartilhado-Meta**, **Perfil-only**, com justificativa e referência à tabela/política RLS principal.

## Entregáveis

- `/mnt/documents/permissoes-niveis.md` (~15–25 KB)
- Sem mudanças no código.
