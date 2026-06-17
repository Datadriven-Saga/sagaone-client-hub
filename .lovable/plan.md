## Diagnóstico

O insert de `campaign_jobs` com `status: 'scheduled'` viola o check constraint atual, que só aceita `pending | processing | completed | failed | cancelled`. O mesmo vale para `campaign_batches` (aceita só `pending | processing | completed | failed`), e o código também insere batches com `status: 'scheduled'`.

```
Confirmado:
- campaign_jobs_status_check NÃO inclui 'scheduled'
- campaign_batches_status_check NÃO inclui 'scheduled'
- EventoBase.tsx insere jobs/batches com status='scheduled' (linhas 1677 e 1708)
```

## Correção

Migração para ampliar os dois check constraints e permitir o status `scheduled`, sem alterar outros valores existentes nem nenhuma lógica.

### SQL

```sql
ALTER TABLE public.campaign_jobs DROP CONSTRAINT campaign_jobs_status_check;
ALTER TABLE public.campaign_jobs ADD CONSTRAINT campaign_jobs_status_check
  CHECK (status IN ('pending','processing','completed','failed','cancelled','scheduled'));

ALTER TABLE public.campaign_batches DROP CONSTRAINT campaign_batches_status_check;
ALTER TABLE public.campaign_batches ADD CONSTRAINT campaign_batches_status_check
  CHECK (status IN ('pending','processing','completed','failed','scheduled'));
```

### O que NÃO alterar
- Lógica de criação de jobs/batches em `EventoBase.tsx`.
- Outras tabelas, RPCs, RLS, índices.
- Nenhum dado existente (a migração só amplia o conjunto permitido).

### Risco
Mínimo. Apenas amplia valores aceitos. Sem rewrite de tabela (CHECK simples revalida linhas existentes — todas já estão no subconjunto antigo, então passam).

### Teste
1. Programar disparo no `/prospeccao/eventos/.../base` — deve criar `campaign_jobs` com `status=scheduled` e batches com `status=scheduled`.
2. Disparar imediato — continua funcionando com `pending`.
