# Manual do Usuário — SagaOne

> Última revisão: 2026-07-01 · Tom: direto, chão-de-loja.

Este manual é organizado por **perfil de uso**. Cada capítulo é auto-contido — não precisa ler documentação técnica para operar o sistema. Onde há dúvida sobre uma regra ainda não decidida pelo time, o texto marca **TBD** explicitamente.

No futuro esses capítulos vão receber vídeos curtos (padrão da tela de Cadeiras). A lista priorizada está em [CHECKLIST-VIDEOS.md](./CHECKLIST-VIDEOS.md).

## Capítulos

1. [Primeiros passos](./01-primeiros-passos.md) — login, empresa ativa, sessão.
2. [Recepção](./02-recepcao.md) — check-in via QR, FAB e Kanban; busca por telefone; vendedor de atendimento.
3. [Prospecção e Kanban](./03-prospeccao-kanban.md) — status, atribuição SDR, filtros, temperatura, anotações.
4. [Disparo WhatsApp](./04-disparo-whatsapp.md) — evento base, planilha vs pool, template, cadência, agendamento, template pausado.
5. [Pós-Vendas](./05-pos-vendas.md) — Peças e Entregas (multi-template), Agendamentos, Cadência, agente compartilhado por marca/UF.
6. [Relatórios](./06-relatorios.md) — dashboards WhatsApp/Ligação, relatório de convidados, exportação.
7. [Administração](./07-administracao.md) — feature flags, MFA/Vault, quarentena manual, monitor nacional.
8. [Perfis e responsabilidades](./08-perfis-e-responsabilidades.md) — matriz "quem faz o quê".
9. [Glossário rápido](./09-glossario-rapido.md) — termos do dia a dia.

## Perfis × capítulos

| Perfil | Essenciais | Complementares |
|---|---|---|
| **Recepcionista** | 1, 2 | 9 |
| **SDR** | 1, 3 | 9 |
| **Vendedor** | 1, 3 | 5, 9 |
| **Gestor de leads** | 1, 3, 4, 6 | 5, 8, 9 |
| **CRM** | 1, 4, 5, 7 (quarentena) | 6, 8, 9 |
| **Admin / TI** | 1, 7 | 8, 9 |
| **Master** | Todos | — |

## Como este manual é mantido

- Cada capítulo é escrito em linguagem de negócio. Detalhes de banco, RPCs e Edge Functions ficam em `docs/` (área técnica).
- Quando uma regra muda, atualizar o capítulo do manual **e** o doc técnico no mesmo PR.
- Itens marcados **TBD** são decisões pendentes de negócio — não são bugs.