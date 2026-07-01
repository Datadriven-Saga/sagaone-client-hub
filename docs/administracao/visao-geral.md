# Administração — Visão Geral

**Área:** Administração
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Área `/administracao` reúne configuração de empresas, controle de acessos, feature flags, logs e monitores. Perfis com acesso: **Master**, **Administrador**, **TI**, e alguns módulos abertos para **Gerente**.

## Sub-módulos

| Rota | Módulo | Doc |
|---|---|---|
| `/administracao/empresas` | Empresas e Cadeiras (sync terceiros) | [empresas-e-cadeiras.md](./empresas-e-cadeiras.md) |
| `/administracao/controle-acessos` | RBAC granular por perfil | [controle-acessos.md](./controle-acessos.md) |
| `/administracao/feature-flags` | Flags globais e por empresa | [feature-flags.md](./feature-flags.md) |
| `/administracao/mfa-*` | MFA e Vault | [mfa-vault.md](./mfa-vault.md) |
| `/administracao/quarentena` | Gestão manual de quarentena | [quarentena-manual.md](./quarentena-manual.md) |
| `/administracao/logs-disparos` | Auditoria de disparos WPP | [logs-disparos.md](./logs-disparos.md) |
| `/administracao/monitor-disparos` | Monitor nacional em tempo real | [monitor-disparos-nacional.md](./monitor-disparos-nacional.md) |

## Hierarquia de acesso (12 níveis)

Definida em `PermissionRegistry` (memory `access-hierarchy-levels`). **Master** sobrescreve tudo. **Admin** e **TI** têm acesso total à Administração. **Gerente** vê subset (monitor, logs). Demais perfis não entram.

## Regras invariantes

- Toda ação sensível grava em `logs_prospeccoes` ou `mfa_audit_logs`.
- Alterações de RBAC exigem confirmação MFA em perfis Master (memory `mfa/ownership-access-restriction`).
- Empresa sandbox `b32ae8c9-...` é reservada — só Admin/TI/Master a veem.

## Relacionado

- [Permissões e RBAC](../arquitetura/permissoes-e-rbac.md) *(pendente)*
- [RBAC — inventariado](../historico/rbac-inventariado.md)