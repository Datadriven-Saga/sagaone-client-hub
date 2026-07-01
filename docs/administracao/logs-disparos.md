# Logs de Disparos (tela admin)

**Área:** Administração
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Tela `/administracao/logs-disparos` — auditoria administrativa de todos os disparos WhatsApp, com filtros por empresa/evento/data e visão de custos.

## Fluxo funcional

1. Filtros: empresa, evento, período, template, status (enviado/falha/pausado).
2. Tabela lista cada disparo com: contato, telefone, evento, template, status Meta, custo estimado.
3. Toggle **USD ↔ BRL** — cotação vem de `cotacao-dolar` (cache 24 h).
4. Exportação CSV.

## Detalhes técnicos

- **Página:** `src/pages/admin/LogsDisparos.tsx`.
- **Tabela:** `logs_disparos` (origem canônica é Edge Function, memory `logs-disparos-server-side`).
- **Custo:** USD gravado no log; BRL calculado em runtime via cotação.
- **Falhas:** `logs_disparos_falhas` linka o erro Meta ao log correspondente.

## Regras

- Cada linha vem da Edge Function (`origem='edge_function'`). Nunca inserir manualmente pelo FE.
- Custos seguem `CUSTO_POR_CATEGORIA` (MARKETING = 0.0625 USD, UTILITY/AUTHENTICATION = 0.0068 USD).
- Filtro por empresa respeita permissões — Gerente só vê a própria.

## Relacionado

- [Logs de disparos (Prospecção)](../prospeccao/logs-disparos.md)
- [Monitor nacional](./monitor-disparos-nacional.md)