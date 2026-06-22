## Resposta à pergunta

**Disparos agendados no banco (status `scheduled`, `scheduled_at > agora`):**

| Empresa | Jobs | Lotes | Leads pendentes | Próximo envio | Último envio |
|---|---|---|---|---|---|
| HYUNDAI SIA | 2 | 76 | 15.089 | hoje 18:00 | hoje 23:00 |

Nenhuma outra empresa tem disparos programados no momento.

**O que é o "Lock":**
- `campaign_batches.locked_at` / `locked_by` são um mecanismo interno de concorrência.
- Quando o `process-campaign-job` (imediato) ou o `scheduled-campaign-dispatcher` (cron) reivindica um lote para processar, ele grava `locked_at = now()` e `locked_by = <worker_id>` via `claim_next_immediate_batch` para impedir que dois workers peguem o mesmo lote.
- Se o `locked_at` ficar > 10 min sem progresso, o lote é considerado órfão e pode ser re-reivindicado (auto-recovery).
- Hoje a coluna está exposta crua no modal "Lotes programados" (`DisparosProgramadosList.tsx`) — é detalhe técnico que não ajuda o usuário.

## Mudança aprovada

Renomear a coluna **Lock** para **"Em processamento desde"** e mostrar o valor **apenas quando o lote está realmente em execução** (`status = 'processing'`); nos demais status, exibir `—`.

## Plano de implementação

**Arquivo:** `src/components/DisparosProgramadosList.tsx`

1. No `<TableHead>` da tabela de lotes do `Dialog`, trocar `Lock` por `Em processamento desde`.
2. Na `<TableCell>` correspondente, renderizar `b.status === 'processing' ? fmt(b.locked_at) : '—'`.
3. Nada mais muda — `locked_at` continua no banco, no hook e na lógica de recuperação intactos.

Sem migrações, sem mudanças de backend, sem mudanças em outras telas.
