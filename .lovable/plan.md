## Objetivo

Fazer o modal de "Importação Parcial" fechar a conta: `total = mostrados`. Hoje 341 linhas somem porque o `process-import` descarta silenciosamente duplicatas dentro do próprio arquivo, telefones vazios e conflitos que o usuário mandou pular — nada disso aparece em nenhum bucket.

## Escopo

Apenas exposição de contadores. Não muda a lógica de descarte (o comportamento de deduplicar por `telefone` normalizado continua igual). Não mexe em `bulk_upsert_contatos`.

## Mudanças

### 1. `import_logs` — 4 colunas novas (migration)

```sql
ALTER TABLE public.import_logs
  ADD COLUMN skipped_duplicate_in_file int NOT NULL DEFAULT 0,
  ADD COLUMN skipped_empty_phone       int NOT NULL DEFAULT 0,
  ADD COLUMN skipped_by_user_conflict  int NOT NULL DEFAULT 0,
  ADD COLUMN blocked_optout_externo    int NOT NULL DEFAULT 0,
  ADD COLUMN blocked_optout_global     int NOT NULL DEFAULT 0;
```

Motivo de separar `blocked_optout_externo` de `blocked_optout_global`: hoje o externo é contado só em memória (`totalOptOutBlocked`) e o global é ignorado por completo. Persistir ambos permite auditar histórico.

Sem alterações de RLS/GRANT (colunas em tabela já existente).

### 2. `supabase/functions/process-import/index.ts`

- Criar contadores locais: `skippedEmptyPhone`, `skippedDuplicateInFile`, `skippedByUserConflict`, `blockedOptoutGlobal`.
- Incrementar nos três `continue` silenciosos do loop principal (linhas ~690, ~706, ~713).
- Somar `result.global_blocked` retornado por `bulk_upsert_contatos` em `blockedOptoutGlobal`.
- Persistir todos os novos campos em cada `update` de `import_logs` (heartbeat, flush final, self-chain).
- Retomar valores de `log.*` no início da execução para self-chain preservar o acumulado.
- Ajustar mensagem final para incluir os novos buckets quando > 0.

### 3. Modal `Importação Parcial` (UI)

Arquivo do modal que renderiza o resumo hoje (Total, Novos, Contatos, Vinculados, Bloqueados, números no processamento, Detalhes dos erros). Preciso localizar — provavelmente em `src/components/import/*` ou perto do fluxo de `UploadPlanilha`. Vou identificar no build mode.

Adicionar linhas (só quando > 0):

- **Duplicatas na planilha** (amarelo) — `skipped_duplicate_in_file`
- **Linhas sem telefone** (amarelo) — `skipped_empty_phone`
- **Conflitos ignorados por você** (cinza) — `skipped_by_user_conflict`
- **Bloqueados por opt-out global** (vermelho) — `blocked_optout_global`
- Renomear "números no processamento" para o que realmente é (checar o que popula esse valor — pode ser `errors`).

Adicionar tooltip curto em cada linha nova explicando o que aconteceu (ex.: "Mesmo telefone apareceu mais de uma vez no arquivo. Só a primeira ocorrência foi processada.").

Adicionar no rodapé do modal uma linha de conferência: `Total conferido: X/Y ✓` quando fecha, `Divergência: N linhas` quando não fecha (protege contra futuras regressões).

### 4. Tipos

Regenerar `src/integrations/supabase/types.ts` acontece automaticamente após a migration.

## Fora do escopo

- Alterar `bulk_upsert_contatos` (só consome `global_blocked` que já existe).
- Mudar a UX do diálogo de conflitos.
- Backfill dos `import_logs` antigos — colunas novas ficam em 0 para importações anteriores.

## Testes / verificação

1. Reimportar uma planilha com duplicatas conhecidas e conferir que `duplicatas + vinculados + quarentena + opt-out ext + inválidos = total`.
2. Planilha só com telefones vazios → cai tudo em `skipped_empty_phone`, `linked = 0`.
3. Planilha com número em `global_opt_outs` → aparece em `blocked_optout_global`.
4. Importação grande que dispara self-chain → contadores acumulam entre execuções (não zeram no chain).

## Detalhes técnicos

- Ordem no loop de descarte importa: `empty_phone` → `invalid_phone (errors)` → `duplicate_in_file` → `skipSet` → batch. Manter essa ordem.
- `processedRows` continua sendo incrementado em todos os casos — é a contagem de "linhas lidas do arquivo", garantindo que a soma bata com `total_rows`.
- Mostrar os novos campos no modal só quando > 0 para não poluir importações limpas.
