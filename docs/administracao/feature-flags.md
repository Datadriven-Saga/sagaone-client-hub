# Feature Flags

**Área:** Administração
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Sistema de ativação/desativação de funcionalidades **globalmente** ou **por empresa**, sem redeploy. Centralizado em `system_feature_flags` (memory `feature-flags-centralization`).

## Fluxo funcional

1. Admin abre `/administracao/feature-flags`.
2. Lista mostra flags com escopo (global vs. per-empresa), estado atual e descrição.
3. Toggle imediato — mudança propagada via `useFeatureFlags` no FE.
4. Overrides por empresa vivem em `feature_flag_empresas`.

## Detalhes técnicos

- **Tabelas:** `system_feature_flags` (catálogo), `feature_flag_empresas` (overrides).
- **Hook:** `src/hooks/useFeatureFlags.ts`.
- **RPC:** `get_feature_flag(chave, empresa_id?)` — resolve override → global.
- **Realtime:** flags são recarregadas ao mudar (subscribe em `system_feature_flags`).

## Flags relevantes

| Flag | Escopo | Efeito |
|---|---|---|
| `webhook_movimentacao_lead` | per-empresa | Habilita webhook out para MobiGestor no check-in/mudança de status |
| `webhook_movimentacao_lead_per_empresa` | per-empresa | URL alternativa por empresa |
| `pos_vendas_multi_template` | per-empresa | Ativa multi-template em Entregas |
| `relatorio_convidados_per_empresa` | per-empresa | Habilita relatório de convidados |

## Regras

- Toggle sem override = usa valor global.
- Empresa sandbox (`b32ae8c9-...`) recebe todas as flags como se estivessem ligadas para teste.
- Flags novas devem ter default seguro (`false`) e ser documentadas no PR.

## Relacionado

- [Visão geral Administração](./visao-geral.md)