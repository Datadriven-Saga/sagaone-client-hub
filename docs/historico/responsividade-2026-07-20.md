# Responsividade — auditoria pública 2026-07-20

Rodada de fechamento do plano `docs/responsividade-diagnostico.md` (Fases 0–5).

## Contexto do ambiente

- `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged` — sem sessão injetável no sandbox.
- Cobertura limitada às rotas públicas (`/login`, `/login/otp`, `/login/terceiros`).
- Rotas autenticadas ficam pendentes de auditoria em ambiente com sessão válida (pré-prod ou prod com usuário de teste). Reexecutar com `bun run responsivo:audit -- --routes=/,/prospeccao,/recepcao,/resultados,/pos-vendas/agendamentos,/administracao,...`.

## Sumário

| Métrica | Valor |
|---|---|
| Rotas testadas | 3 |
| Viewports | 6 (360, 390, 768, 1024, 1440, 1920) |
| Rotas c/ scroll horizontal (mobile ≤ 480) | **0** |
| Rotas c/ scroll horizontal (desktop ≥ 1024) | **0** |
| Hitboxes < 44px (soma mobile) | 16 |
| Erros de navegação | 0 |

## Detalhes

| Rota | Viewport | Overflow-X | scrollWidth | Hitbox<44 |
|---|---|---|---|---|
| /login | mobile-360 | ✅ | 360 | 3 |
| /login | mobile-390 | ✅ | 390 | 3 |
| /login | tablet-768 | ✅ | 768 | 0 |
| /login | desktop-1024 | ✅ | 1024 | 0 |
| /login | desktop-1440 | ✅ | 1440 | 0 |
| /login | wide-1920 | ✅ | 1920 | 0 |
| /login/otp | mobile-360 | ✅ | 360 | 2 |
| /login/otp | mobile-390 | ✅ | 390 | 2 |
| /login/otp | tablet-768 | ✅ | 768 | 2 |
| /login/otp | desktop-1024 | ✅ | 1024 | 2 |
| /login/otp | desktop-1440 | ✅ | 1440 | 2 |
| /login/otp | wide-1920 | ✅ | 1920 | 2 |
| /login/terceiros | mobile-360 | ✅ | 360 | 3 |
| /login/terceiros | mobile-390 | ✅ | 390 | 3 |
| /login/terceiros | tablet-768 | ✅ | 768 | 3 |
| /login/terceiros | desktop-1024 | ✅ | 1024 | 3 |
| /login/terceiros | desktop-1440 | ✅ | 1440 | 3 |
| /login/terceiros | wide-1920 | ✅ | 1920 | 3 |

## Análise dos hitboxes < 44px

Todos remanescentes são links textuais discretos (não CTAs primários):

- `/login`: âncoras "Login para terceiros" e "Entrar com código por email" no rodapé do card mobile + o ícone SVG Microsoft embutido no botão (o botão em si é 44×44, o SVG é decorativo).
- `/login/otp`: link "Voltar para login Microsoft" e ícone `Mail` decorativo.
- `/login/terceiros`: link "Voltar para login Microsoft" e ícones decorativos.

**Decisão:** não são bloqueadores WCAG 2.5.5 (links textuais em contexto de parágrafo têm exceção). Meta da seção 1.5 (`≤ 5 por rota`) atendida.

## Snapshot da baseline pública

- **0** rotas com overflow horizontal em qualquer viewport.
- **0** erros de navegação.
- Screenshots arquivados em `/tmp/browser/responsivo/2026-07-20T12-15-04-068Z/screenshots/` (não versionados).

## Pendências herdadas do plano

1. Rodar `responsivo:audit` autenticado em ambiente com sessão SSO válida cobrindo `/`, `/prospeccao`, `/recepcao`, `/resultados`, `/pos-vendas/agendamentos` e toda a árvore `/administracao/*`.
2. `useAutoScrollFocusInContainer` aplicado em `CriarProspeccaoModal` (2026-07-19). Pendências campo-a-campo do plano original substituídas por 1 ref no body do modal — mesma cobertura, menor custo.
3. Sweep final de `w-[Npx]` fechado com exceções documentadas (25 ocorrências restantes são `TableHead`, popovers Radix, skeletons e SVGs).
4. Grids de KPIs padronizados (2026-07-19): `AdminDashboardLigacao`, `MetricasLigacaoTab`, `DashboardLigacaoTab` migrados para `grid-cols-2 sm:grid-cols-3 md:grid-cols-4|5`.

## Conclusão

Plano de responsividade fica encerrado no escopo executável dentro do sandbox. Item 1 acima é o único bloqueador para o "fechamento total" e depende de ambiente autenticado — reexecutar `bun run responsivo:audit` em pré-prod e anexar o novo relatório neste diretório.