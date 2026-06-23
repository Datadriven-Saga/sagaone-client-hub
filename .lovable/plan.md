## Resumo

Dois problemas no mesmo lugar (`/prospeccao/eventos/.../base` → "Disparos programados"):

1. **Cancelar disparo agendado dá 400** — `function public.user_can_access_empresa(uuid) is not unique`.
2. **"Vários agendamentos no mesmo horário"** — não é duplicação real, é apresentação. Cada lote de negócio é fatiado em chunks físicos de 250 leads no insert dos `campaign_batches`, e o modal lista cada chunk como uma linha.

---

## Diagnóstico

### 1. Cancelamento — overload ambíguo

A função `public.cancel_scheduled_campaign_job(p_job_id uuid)` chama:

```sql
public.user_can_access_empresa(v_job.empresa_id)
```

Mas hoje existem **duas** funções com esse nome (memória `intentional-function-overloads` registra esta como exceção):

- `user_can_access_empresa(target_empresa_id uuid)` — wrapper de 1 arg.
- `user_can_access_empresa(target_empresa_id uuid, user_id uuid DEFAULT auth.uid())` — implementação real.

Como o segundo tem default, o Postgres considera os dois candidatos para a chamada de 1 arg → `42725 is not unique`. Cada chamada feita do RPC explode com 400.

Evidência: `pg_get_functiondef` confirma as duas assinaturas e o `RAISE EXCEPTION 'Acesso negado'` nem chega a rodar — o resolver de função quebra antes.

### 2. "Vários no mesmo horário" — não é duplicação

Job `23a45ad7-…` (prospecção `0dc6e182-…`): 6.580 leads, cadência `by_lot_size` a cada 30 min → 7 lotes de negócio (`lot_index` 0–6, ~1.000 leads cada).

No insert em `EventoBase.tsx` (linhas 1734-1751), cada lote de negócio é dividido em chunks físicos de `CHUNK=250` para o dispatcher:

```ts
for (const lote of lotesNegocio) {
  for (let i = 0; i < lote.ids.length; i += CHUNK) {
    batchInserts.push({ ..., lot_index: lote.lot_index, scheduled_at: lote.scheduled_at });
  }
}
```

→ 4 registros em `campaign_batches` com mesmo `lot_index` e mesmo `scheduled_at` por lote de negócio. Total: 27 batches físicos para 7 lotes lógicos. `DisparosProgramadosList` lista cada batch físico, dando a impressão de "vários agendamentos no mesmo horário". Não é bug de duplicação — é design (o dispatcher trabalha em chunks de 250). O bug é só na apresentação.

---

## Plano de correção

### Mudança 1 — Fix do cancelamento (migration SQL)

Recriar `public.cancel_scheduled_campaign_job` passando `auth.uid()` explicitamente para resolver o overload:

```sql
IF v_uid IS NULL OR NOT public.user_can_access_empresa(v_job.empresa_id, v_uid) THEN
  RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
END IF;
```

Resto do corpo da função permanece igual (inclusive o `UPDATE campaign_batches SET status='cancelled'` — o check constraint já aceita `cancelled` aqui? **Confirmar antes**: o STEP 4 do webhook precisou usar `failed` porque `campaign_batches_status_check` não permite `cancelled`. Se a RPC sempre falhou no acesso, esse `UPDATE … 'cancelled'` nunca rodou — vou trocar para `'failed'` com `error_log='Cancelado pelo usuário'` para evitar o segundo erro.).

### Mudança 2 — Agrupar lotes na UI por `lot_index`

Em `src/components/DisparosProgramadosList.tsx`:

- Na tabela principal, coluna "Lotes" passa a contar `lot_index` distintos (`new Set(batches.map(b => b.lot_index)).size`), não `batches.length`.
- No modal de detalhes ("Lotes programados"), agrupar batches por `lot_index` antes de renderizar:
  - 1 linha por lote de negócio.
  - "Contatos" = soma de `total_leads` dos chunks daquele `lot_index`.
  - "Status" = status agregado (priorizar `processing` > `scheduled` > `failed` > `cancelled` > `completed`).
  - "Tentativas" = `max(retry_count)`.
  - "Em processamento desde" = mínimo `locked_at` entre chunks em `processing`.
- "Próximo lote" no card principal continua usando `min(scheduled_at)` entre batches `scheduled` — não muda.

Nenhuma mudança em `EventoBase.tsx` (criação dos batches), `process-campaign-job`, ou `scheduled-campaign-dispatcher` — o chunking físico de 250 é proposital.

### Documentação

Atualizar memória `mem://architecture/database/intentional-function-overloads` mencionando que callers SQL de `user_can_access_empresa` devem sempre passar `(empresa_id, auth.uid())` para evitar `42725`.

### O que NÃO alterar

- Lógica de criação de batches (chunk físico de 250).
- `scheduled-campaign-dispatcher`, `process-campaign-job`, `claim_due_campaign_batches`.
- Outras callers SQL de `user_can_access_empresa` (escopo desta correção é só a RPC do cancelamento).
- Overloads em si (memória diz que são intencionais).

### Testes

1. Cancelar um job `scheduled` real (após deploy da migration) → toast de sucesso, batches futuros marcados como `failed` com `error_log='Cancelado pelo usuário'`, job vai a `cancelled`.
2. Cancelar job sem permissão de acesso à empresa → 403 "Acesso negado" (não mais 400 ambíguo).
3. Abrir modal "Lotes programados" do job `23a45ad7-…` → mostrar 7 linhas (uma por `lot_index`), não 27.
4. Coluna "Lotes" da tabela principal → 7, não 27.
