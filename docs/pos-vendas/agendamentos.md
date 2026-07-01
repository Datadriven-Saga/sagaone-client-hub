# Pós-Vendas — Agendamentos

**Área:** Pós-Vendas
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Rota `/pos-vendas/agendamentos` — visão consolidada de agendamentos gerados/tocados pela Paty. Serve para o gestor de pós-venda acompanhar:

- Quantos agendamentos foram criados no período.
- Status (agendado, confirmado, cancelado, no-show, realizado).
- Loja e vendedor responsável.
- Origem (Peças, Entregas, cadência).

## Fluxo funcional (para usuário)

1. Selecionar período e loja (filtros default = últimos 30 dias, todas as lojas da empresa ativa).
2. Tabela lista agendamentos com colunas: cliente, telefone, data/hora, status, origem, template disparado.
3. Ações inline: abrir timeline do lead, reenviar confirmação (dispara template correspondente via Paty).

## Detalhes técnicos

- **Página:** `src/pages/pos-vendas/Agendamentos.tsx`.
- **Componente:** `src/components/pos-vendas/AgendamentosTab.tsx`.
- **Fonte de dados:** stack Paty externa via `external-webhook-proxy` (`endpoint: get-paty-agendamentos`). Não há tabela local persistente — o SagaOne renderiza sob demanda.
- **Cache:** react-query, invalidado ao mudar filtros.
- **Isolamento:** filtra por `empresa_id` da empresa ativa + agentes autorizados. Master vê todas as empresas dentro do escopo.

## Regras de negócio

- Agendamento **não** persiste no Supabase — é sempre lido do backend Paty. Se o n8n estiver fora, a tela mostra estado vazio + toast de erro.
- Reenviar confirmação obedece rate-limit do template (Meta) — chamadas repetidas em <5min podem falhar silenciosamente.
- Status são calculados no backend Paty; alterações precisam vir de lá (não há CRUD no SagaOne).

## Erros comuns

| Sintoma | Causa | Ação |
|---------|-------|------|
| Tabela sempre vazia | Stack Paty fora ou filtro sem match | Ampliar filtro; conferir logs do proxy. |
| Reenviar confirmação sem efeito | Rate-limit Meta ou template pausado | Aguardar; verificar status do template. |
| Contagem diverge de Peças/Entregas | Origens diferentes agregam de tabelas diferentes no banco Paty | Comparar por `origem` — não há reconciliação automática. |

## Relacionado

- [Peças](./pecas.md)
- [Entregas](./entregas.md)
- [Cadência](./cadencia.md)
- [Visão geral](./visao-geral.md)