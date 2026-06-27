## Objetivo

Atualizar `/mnt/documents/status-ingest-base-clientes.md` (v2) refletindo o reprocessamento retroativo executado hoje (27/jun/2026), que trouxe o pool para ~1 ano completo de leads.

## Dados novos coletados

**Saúde geral**
- Jobs totais: **250** (77 → 250) — **246 done** / **4 error** / 0 processing / 0 pending.
- Recebidos: **1.102.450** | Processados: **1.102.430** (≈100%) | Órfãos acumulados: **492**.
- Pool atual: **853.494** linhas — **853.079 ativo** / **415 órfão**.
- Janela coberta: **27/jun/2025 → 27/jun/2026** (1 ano completo, conforme solicitado).

**Pico de reprocessamento (27/jun/2026)**
- 170 jobs no dia, **837.387 leads** processados, apenas 1 órfão.
- Demais dias da última semana mantêm a cadência normal (1 job/dia, 1-6 leads).

**Distribuição mensal (pool_clientes_externos por `criado_em_origem`)**
- jun/25: 7.123 (parcial, início da janela)
- jul/25: 63.332 · ago/25: 58.188 · set/25: 61.167 · out/25: 66.932 · nov/25: 72.828 · dez/25: 69.924
- jan/26: 87.102 · fev/26: 76.476 · mar/26: 95.380 · abr/26: 81.381 · mai/26: 73.347 · jun/26: 40.314 (parcial)

**Erros históricos**
- Mantidos os 4 jobs `error` de 29/abr/2026 (constraint `ON CONFLICT` antiga). Nenhum erro novo desde então, inclusive durante o backfill massivo de hoje.

**Órfãos**
- Total caiu de 414 → **415** (estável). Concentração inalterada:
  - `72341` → 370 · `59925` → 44 · `18399` → 1 (novo, 1 lead).
- Ação pendente continua: cadastrar/ajustar `empresas.crm_id` nessas lojas.

## O que muda no documento

1. Substituir números de saúde, volume, pool e cadência pelos novos.
2. Adicionar seção **"Backfill 27/jun/2026"** descrevendo o reprocessamento (170 jobs, 837k leads, 0 erros).
3. Atualizar a tabela de distribuição mensal mostrando que a meta de **1 ano de histórico** foi atingida.
4. Atualizar lista de órfãos (incluir loja `18399`).
5. Manter seção de riscos (sem alerta de ausência, sem notificação de órfãos, rotação do `DATALAKE_INGEST_TOKEN`).
6. Acrescentar nota: pipeline aguentou 170 jobs/~837k leads no mesmo dia sem erro nem fila — capacidade validada.

## Entregável

- Novo arquivo versionado: `/mnt/documents/status-ingest-base-clientes_v2.md` (não sobrescreve o v1).
- Exposto via `<presentation-artifact>`.
- Nenhuma alteração de código.
