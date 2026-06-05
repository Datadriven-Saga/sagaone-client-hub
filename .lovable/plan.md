## Objetivo

Evitar reprocessar leads que a Lambda já marcou como "Disparo repetido" (anti-dup eterno por número+template), persistir `data_disparo_ia` por **micro-batch** (não 1 a 1) para não perder sucessos em queda sem inflar I/O, e exibir os erros de forma agrupada e amigável (cinza, não vermelho), com log persistido para consulta posterior.

---

## Camadas

### Camada 1 — Persistência incremental por micro-batch (sub-lote)

Em `supabase/functions/process-campaign-job/index.ts`:

- **WhatsApp (L384-481)**: após cada sub-lote de `WA_BATCH_SIZE=5` (o `Promise.allSettled`), fazer **1 flush** com os ids resolvidos naquele sub-lote:
  - `UPDATE contatos SET data_disparo_ia=now() WHERE id = ANY($1)` (sucessos + duplicates desse sub-lote)
  - `UPDATE eventos_prospeccao SET data_disparo_ia=now() WHERE prospeccao_id=$p AND contato_id = ANY($1)`
  - Insert dos itens não-sucesso desse sub-lote em `logs_disparos_falhas` (1 insert múltiplo).
- **Ligação (L309-373)**: idem, 1 flush ao fim de cada `LIGACAO_SUB_BATCH=100` (sucessos vão para `contatos`/`eventos_prospeccao`; upsert em `cadencia_pri_voz` do sub-lote, como já é hoje, mas movido para dentro do laço).
- **Remover** o bloco de persistência em lote final (L484-513) — vira no-op. Manter apenas um flush final defensivo para o último sub-lote, caso ele saia do `for` sem ter rodado o flush.
- Trade-off explícito: ~152 flushes por job de 762 leads no WA (5 em 5) vs 1 update único no final. Cobre o caso de morte da função sem multiplicar round-trips por lead.

### Camada 2 — Anti-duplicado respeitado (não retentar "Disparo repetido")

A Lambda retorna HTTP 400 `{"error":"Disparo repetido!"}` — decisão eterna por número+template.

- Classificar resposta como **`duplicate`** (case-insensitive em `responseBody.includes("Disparo repetido")`), separado de falha real.
- Leads `duplicate`:
  - Recebem `data_disparo_ia = now()` no mesmo flush do sub-lote (saem de "Pendente IA").
  - **NÃO** somam em `failed_records`; somam em nova coluna `campaign_jobs.duplicate_records`.
  - Excluídos de qualquer "Retomar Falhas".
- Resultado: re-disparar a mesma prospecção marca tudo como `duplicate` no 1º POST e nunca mais reenvia.

### Camada 3 — Concorrência (índice único + lock do botão)

- Migration: índice parcial único em `campaign_jobs(empresa_id, prospeccao_id) WHERE status IN ('pending','processing')`.
- `ActiveCampaignJobIndicator` já detecta job ativo da empresa — expor um hook `useActiveCampaignJob(prospeccaoId)` para o botão "Disparar" em `DispararCustoModal` ficar **desabilitado** com tooltip cinza "Já existe um disparo em andamento para esta prospecção".

### Camada 4 — UX de erros amigável + log persistido

- Nova tabela `logs_disparos_falhas` (1 linha por lead que não teve sucesso direto):
  - `job_id`, `batch_id`, `empresa_id`, `prospeccao_id`, `contato_id`, `lead_id`, `telefone`, `nome`, `categoria` (`duplicate` | `timeout` | `http_error` | `workflow_inactive` | `empty_body` | `network` | `outro`), `mensagem`, `http_status`, `created_at`.
  - GRANTs + RLS por empresa.
- Insert em lote (1 statement por sub-lote, junto do flush da Camada 1).
- `DispararProgressModal`:
  - Trocar bloco vermelho "X falha(s)" por bloco neutro (`text-muted-foreground`, fundo `bg-muted/50`) com agregação por categoria, ex:
    ```
    127 já disparados anteriormente
    8 sem resposta do servidor
    3 erro temporário
    ```
  - Quando só houver `duplicate`: título verde "Concluído — todos os leads já haviam sido disparados".
  - Botão "Ver detalhes" abre drawer consultando `logs_disparos_falhas` por `job_id`.
- Status final: se `failed_records (excluindo duplicate) == 0` → `completed`, mesmo com duplicates.

---

## Detalhes técnicos

### Migration

```sql
ALTER TABLE public.campaign_jobs
  ADD COLUMN IF NOT EXISTS duplicate_records int NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_jobs_active_per_prospeccao
  ON public.campaign_jobs(empresa_id, prospeccao_id)
  WHERE status IN ('pending','processing');

CREATE TABLE public.logs_disparos_falhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.campaign_jobs(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.campaign_batches(id) ON DELETE SET NULL,
  empresa_id uuid NOT NULL,
  prospeccao_id uuid,
  contato_id uuid,
  lead_id text,
  telefone text,
  nome text,
  categoria text NOT NULL,
  mensagem text,
  http_status int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.logs_disparos_falhas TO authenticated;
GRANT ALL ON public.logs_disparos_falhas TO service_role;

ALTER TABLE public.logs_disparos_falhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso por empresa" ON public.logs_disparos_falhas
  FOR SELECT TO authenticated
  USING (public.user_can_access_empresa(empresa_id));

CREATE INDEX idx_logs_disparos_falhas_job ON public.logs_disparos_falhas(job_id);
CREATE INDEX idx_logs_disparos_falhas_empresa_data
  ON public.logs_disparos_falhas(empresa_id, created_at DESC);
```

### Classificação

```ts
function classifyError(httpStatus: number, body: string) {
  const b = (body || '').toLowerCase();
  if (b.includes('disparo repetido')) return { categoria: 'duplicate', mensagem: 'Já disparado anteriormente' };
  if (b.includes('workflow not found') || b.includes('not active')) return { categoria: 'workflow_inactive', mensagem: 'Workflow inativo' };
  if (httpStatus === 0) return { categoria: 'timeout', mensagem: 'Sem resposta do servidor' };
  if (httpStatus >= 500) return { categoria: 'http_error', mensagem: `Erro ${httpStatus}` };
  if (!body) return { categoria: 'empty_body', mensagem: 'Resposta vazia' };
  return { categoria: 'outro', mensagem: body.substring(0, 200) };
}
```

### Flush por sub-lote (WA)

```ts
// dentro do for de sub-lotes, após o Promise.allSettled
const subSuccess: string[] = [];
const subDuplicate: string[] = [];
const subFailRows: any[] = [];

for (let ri = 0; ri < results.length; ri++) {
  const lead = subBatch[ri];
  const r = results[ri];
  if (r.status === 'fulfilled') {
    subSuccess.push(lead.id);
  } else {
    const { httpStatus, body } = r.reason?.meta || { httpStatus: 0, body: '' };
    const { categoria, mensagem } = classifyError(httpStatus, body);
    if (categoria === 'duplicate') subDuplicate.push(lead.id);
    else subFailRows.push({ contato_id: lead.id, /* ... */ categoria, mensagem, http_status: httpStatus });
  }
}

const markIds = [...subSuccess, ...subDuplicate];
if (markIds.length) {
  const ts = new Date().toISOString();
  await supabase.from('contatos').update({ data_disparo_ia: ts }).in('id', markIds);
  await supabase.from('eventos_prospeccao')
    .update({ data_disparo_ia: ts })
    .eq('prospeccao_id', job.prospeccao_id)
    .in('contato_id', markIds);
}
if (subFailRows.length) {
  await supabase.from('logs_disparos_falhas').insert(subFailRows.map(r => ({
    ...r, job_id, batch_id: batch.id, empresa_id: job.empresa_id, prospeccao_id: job.prospeccao_id
  })));
}

totalProcessed += subSuccess.length;
totalDuplicate += subDuplicate.length;
totalFailed   += subFailRows.length;
await supabase.from('campaign_jobs').update({
  processed_records: totalProcessed,
  duplicate_records: totalDuplicate,
  failed_records: totalFailed,
  updated_at: new Date().toISOString(),
}).eq('id', job_id);
```

Para Ligação: mesma lógica, com `LIGACAO_SUB_BATCH=100`, movendo `cadencia_pri_voz` upsert para dentro do laço.

### Componentes a tocar

- `supabase/functions/process-campaign-job/index.ts` — flush por sub-lote, classificação, duplicate handling, insert em `logs_disparos_falhas`, remover persistência em lote final.
- `src/components/DispararProgressModal.tsx` — UI cinza agregada, drawer de detalhes, título amigável quando só duplicates.
- `src/components/ActiveCampaignJobIndicator.tsx` — expor hook `useActiveCampaignJob(prospeccaoId)`.
- `src/components/DispararCustoModal.tsx` (+ qualquer outro botão "Disparar") — desabilitar quando job ativo da mesma prospecção.
- Nova migration.

### O que NÃO alterar

- `bulk_upsert_contatos`, quarentena, RLS de `eventos_prospeccao`/`contatos`.
- Lógica do webhook externo (n8n/Lambda).
- `logs_disparos` (continua como hoje, server-side por batch). A nova tabela é granular por lead.

### Testes obrigatórios

- Disparar prospecção nova → todos sucesso → `data_disparo_ia` preenchido após cada sub-lote.
- Re-disparar mesma prospecção → todos `duplicate`, status `completed`, modal verde-claro "todos já disparados".
- Mistura sucesso + duplicate + timeout → 3 contadores separados, log com 3 categorias agregadas em cinza.
- Forçar kill do job no meio → sucessos dos sub-lotes anteriores permanecem persistidos.
- Tentar 2º disparo enquanto há job ativo → bloqueado pelo índice único + botão desabilitado.
- Importação por planilha continua funcionando (não tocamos em `bulk_upsert_contatos`).
