# Plano — Corrigir "Erro ao criar lead" (PGRST203)

## Diagnóstico confirmado

Nos logs de `create-lead`:

```
PGRST203 — Could not choose the best candidate function between:
  bulk_upsert_contatos(jsonb, uuid, uuid, text, boolean)                 -- 5 args
  bulk_upsert_contatos(jsonb, uuid, uuid, text, boolean, boolean)        -- 6 args
```

- `process-import` (planilha) passa 6 args → funciona → `import_logs` saudável.
- `create-lead`, `create-lead-pri`, `useBulkImport` passam 5 args → ambiguidade → HTTP 500.

Não é bug de SDR, equipe, RLS ou vínculo do evento. É overload duplicado — viola a regra Core "No SQL function overloads to prevent PostgREST ambiguity".

## Correção

Migration única removendo a assinatura antiga de 5 args. A assinatura de 6 args tem `p_strict_responsavel boolean DEFAULT false`, então os callers de 5 args voltam a funcionar sem alteração de código, com comportamento idêntico ao anterior à criação do overload.

```sql
DROP FUNCTION IF EXISTS public.bulk_upsert_contatos(
  jsonb, uuid, uuid, text, boolean
);
```

Nenhuma alteração no corpo da função de 6 args. Nenhuma alteração em código de callers.

## Verificação após migration

1. `SELECT count(*) FROM pg_proc WHERE proname='bulk_upsert_contatos'` → deve retornar 1.
2. Cadastrar lead novamente pela UI (mesmo cenário do print, SDR) → esperado 200 + lead vinculado ao evento.
3. Confirmar que uma nova importação de planilha continua concluindo (process-import intacto — segue passando 6 args).
4. `create-lead-pri`: opcional, disparar payload de teste do webhook PRI.

## O que NÃO alterar

- Corpo de `bulk_upsert_contatos` (6 args) — zona crítica por KB.
- Nenhum arquivo em `supabase/functions/**` ou `src/hooks/useBulkImport.ts`.
- `contato_quarentena`, `upsert_quarentena`, `eventos_prospeccao` — fora do escopo.

## Riscos

- Baixo. Callers externos (se existirem fora do repo) que usem parâmetros nomeados continuam funcionando na assinatura de 6 args.
- Rollback: recriar a função de 5 args reintroduz a ambiguidade — não recomendado. Se aparecer regressão, investigar o caller específico e adicionar `p_strict_responsavel` explícito nele.
