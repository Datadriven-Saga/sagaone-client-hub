# Status Report — `ingest-base-clientes`

Levantei os dados em `pool_ingestao_jobs`, `pool_clientes_externos` e nos logs da edge. Abaixo o resumo que vai virar o documento.

## Saúde geral
- **Status atual:** operando normalmente (último job 2026-06-27 03:00 UTC, `done`, 4 leads em 0,9s).
- **Jobs totais:** 81 — **77 done** / **4 error** (todos em 29/abr/2026, mesma causa).
- **Volume acumulado:** 265.047 leads recebidos = 265.047 processados (100%), 491 marcados como `orfao`.
- **Pool atual (`pool_clientes_externos`):** 229.196 `ativo` + 414 `orfao` = 229.610 linhas.
- **Edge logs:** sem entradas recentes (função fica idle entre os ticks diários — esperado, sem invocações com erro recente).

## Cadência observada (últimos 30 dias)
- Recebimento diário ~03:00 UTC (00:00 BRT), 1 job/dia, payloads pequenos (1-6 leads).
- Pico isolado em 02/jun: 10 jobs / 45.069 leads (provável re-ingestão histórica).
- Sem falhas, sem órfãos novos no período.

## Erros históricos
- Todos os 4 jobs `error` ocorreram em 29/abr/2026 com a mesma mensagem:  
  `there is no unique or exclusion constraint matching the ON CONFLICT specification`.
- Causa: upsert usa `onConflict: 'codigo_proposta'` e a unique global em `pool_clientes_externos.codigo_proposta` ainda não existia. Foi corrigido depois (jobs seguintes passaram).
- **Nenhum erro desde 29/abr** — backlog zerado.

## Órfãos
- 414 registros `orfao` no pool, concentrados em 2 `codigo_loja` sem empresa cadastrada:
  - `72341` → 370 leads
  - `59925` → 44 leads
- Motivo: `empresas.crm_id` não bate. Resolver é cadastrar/ajustar `crm_id` nessas duas empresas — o reprocessamento move automaticamente para `ativo` no próximo upsert.

## Riscos / pontos de atenção
1. **Sem alerta automático** se nenhum job chegar em determinado dia (Datalake pode falhar silenciosamente).
2. **Órfãos não geram notificação** — só aparecem se alguém consultar a tabela.
3. **`DATALAKE_INGEST_TOKEN`** é o único gate de auth — confirmar rotação periódica.

## Entregável
Gerar `/mnt/documents/status-ingest-base-clientes.md` com o conteúdo acima estruturado (sumário executivo, métricas, tabela de cadência, erros, órfãos, riscos e recomendações) e expô-lo via `<presentation-artifact>` para download.

Nenhuma alteração de código nesta tarefa — somente leitura + documento.
