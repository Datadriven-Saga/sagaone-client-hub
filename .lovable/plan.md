
## Diagnóstico

Duas causas confirmadas nos toasts da tela:

1. **"CREATE TABLE AS is not allowed in a non-volatile function"** — em `public.get_diagnostico_eventos_leads` (migração `20260721202247_...`) a função está declarada `STABLE`, mas o corpo executa:
   ```sql
   CREATE TEMP TABLE IF NOT EXISTS _tmp_diag ON COMMIT DROP AS SELECT 1 WHERE false;
   ```
   Postgres proíbe DDL em funções não-voláteis. Essa linha é resíduo/desnecessária.

2. **"canceling statement due to statement timeout"** em `get_diagnostico_eventos_kpis` — sem filtros, o CTE `leads_scope` faz `JOIN eventos_prospeccao × contatos × prospeccoes` para toda a base (exceto EMPRESA ADMIN) e chama `get_contato_status_por_evento(...)` linha a linha. Isso extrapola o `statement_timeout` do role `authenticated`.

## Correções

### 1. Migração SQL

- Remover o `CREATE TEMP TABLE ...` de `get_diagnostico_eventos_leads`.
- Recriar `get_diagnostico_eventos_kpis` e `get_diagnostico_eventos_leads` com:
  - Guarda de escopo: exigir **pelo menos um filtro** entre `empresa_ids`, `prospeccao_ids`, `terceiro_ids`, `seat_ids` ou intervalo de datas. Sem filtro, retornar KPIs zerados / `rows: []` — evita full scan.
  - Aplicar `data_de/data_ate` como **janela default de 60 dias** quando nenhum filtro estruturado for informado mas o usuário abrir a tela (garantia extra).
  - Trocar chamada por linha de `get_contato_status_por_evento` por **subquery lateral única** que lê o último log em `logs_movimentacao_contatos` por `(contato_id, prospeccao_id)`, caindo em `contatos.status` só quando não há log — mesma regra da função, sem overhead de N chamadas PLPGSQL.

### 2. Frontend (`src/hooks/useDiagnosticoEventos.ts` + `DiagnosticoEventos.tsx`)

- Não chamar `fetchKpis`/`fetchLeads` no mount sem filtros.
- Mostrar estado inicial "Selecione um filtro para carregar o diagnóstico".
- Exibir a mensagem de erro real vinda da RPC (quando `filtros_obrigatorios`) em vez do toast genérico.

## O que NÃO alterar

- Assinaturas públicas das RPCs (mesmos nomes/args) — só corpo/comportamento.
- `get_contato_status_por_evento` continua sendo a fonte canônica de status por evento (usada em outros lugares).
- Guarda `is_admin_diagnostico` e GRANTs.

## Teste

- Abrir a tela sem filtro → estado vazio, sem toast de erro.
- Filtrar por 1 empresa → KPIs e tabela carregam < 3 s.
- Filtrar por 1 evento → mesma coisa; ações em lote continuam funcionando.
