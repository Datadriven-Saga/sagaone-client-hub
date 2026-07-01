# Monitor Nacional de Disparos

**Área:** Administração
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Tela `/administracao/monitor-disparos` — visão consolidada, cross-empresa, de todos os disparos agendados e em execução. Usada por Master/Admin para acompanhar carga nacional em tempo real.

## Fluxo funcional

1. Cabeçalho: total de leads a disparar nas próximas 24 h, jobs ativos, falhas.
2. Gráfico de barras por hora (próximas 24 h) — quantos disparos por faixa horária.
3. Tabela por empresa/evento com status agregado (`scheduled`, `processing`, `partially_completed`, `failed`).
4. Atualização automática (poll a cada 30 s).

## Detalhes técnicos

- **Página:** `src/pages/admin/MonitorDisparos.tsx` *(referência)*.
- **Fonte:** `campaign_jobs` + `campaign_batches` + view `vw_immediate_jobs_status`.
- **Agregação:** consulta por hora (`date_trunc('hour', scheduled_for)`).
- **Cron dispatcher:** `scheduled-campaign-dispatcher` roda a cada 5 min (memory `persistent-campaign-dispatch-system`).

## Regras

- Master/Admin/TI vêem todas as empresas. Demais perfis não têm acesso.
- Empresa sandbox é excluída dos totais.
- Jobs travados >10 min em `processing` aparecem com badge de alerta.

## Relacionado

- [Disparo WhatsApp](../prospeccao/dispatch-whatsapp.md)
- [Recuperação de jobs órfãos](../prospeccao/recuperacao-jobs-orfaos.md)
- [Template pausado](../prospeccao/template-pausado.md)