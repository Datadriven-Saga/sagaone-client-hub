# Permissões e RBAC

**Área:** Arquitetura
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## Hierarquia (12 níveis)

Definida em `PermissionRegistry` (memory `access-hierarchy-levels`):

```
Master > Administrador > TI > Gerente > CRM > Vendedor > SDR
       > Recepcionista > Colaborador > Convidado > ...
```

Master **sobrescreve** qualquer negação. Demais perfis herdam permissões via `cargo_tipo_acesso_mapping`.

## Componentes-chave

- **`PermissionRegistry`** — catálogo de chaves (`canAccessProspeccao`, `canImportPoolFull`, ...).
- **`useUserAccessType`** — hook que resolve `tipo_acesso` do usuário atual.
- **`PermissionProtectedRoute`** — guard de rota por chave (memory `route-and-component-guard-alignment`).
- **`departamento_permissoes`** — override por departamento.

## Categorias de permissão

| Categoria | Exemplos |
|---|---|
| Rotas | `canAccessProspeccao`, `canAccessPosVendas`, `canAccessAdministracao` |
| Dados | `canImportPoolFull`, `canImportPoolReadOnly`, `canViewAllLeads` |
| Ações | `canDispatchCampaign`, `canManageProspeccaoEquipes` |
| Master | `isMaster` (bypass total), `canAccessMFAVault` |

## Visibilidade de leads

SDR/Vendedor veem só leads da sua equipe (memory `lead-visibility-security-rules` + `prospeccao_equipe_membros`). Gerente vê equipe inteira. CRM/Admin/Master vêem tudo.

## RLS Security Definer

Padrão: RPC `SECURITY DEFINER` que valida `user_can_access_empresa` e devolve dados filtrados. Evita recursão em políticas RLS (memory `rls-security-definer-pattern`).

## Documentos históricos

- [RBAC — inventariado](../historico/rbac-inventariado.md) — plano original de RBAC fine-grained (parcialmente implementado).
- [Controle de Acessos — auxiliar](../administracao/controle-acessos-auxiliar-detalhado.md).

## Relacionado

- [Multi-tenant](./multi-tenant.md)
- [Controle de Acessos](../administracao/controle-acessos.md)