## Diagnóstico

```
Confirmado:
- Job f4cdddc4 está em `processing`, lote 0 concluído às 15:30:21, lote 1 com status `scheduled` para 16:00 (intervalo de 30min entre lotes).
- `process-campaign-job` finaliza o lote, vê que ainda há batches `scheduled`, mantém o job em `processing` e só atualiza `updated_at` (linhas 784-796 do edge function).
- `ActiveCampaignJobIndicator` busca jobs em `pending`/`processing`, e se `updated_at` estiver há >10min, chama `autoResolveStuckJob` que:
  1. Marca o job como `completed`.
  2. Marca TODOS os batches em `pending`/`processing` como `failed`.
- Resultado: por volta de 15:40 (10min após o último update), o job f4cdddc4 vai ser auto-finalizado e o lote 1 (scheduled, 16:00) ficará órfão — o job some do "Em andamento", mas como o batch está `scheduled` (não `pending`/`processing`), o update do indicator não pega ele; o dispatcher cron vai tentar rodar às 16:00, porém o job já está `completed`. Mesmo assim, o contador fica em 8/16 para sempre.
```

A consulta do indicator também ignora `status='scheduled'`, então jobs puramente agendados não disparam o auto-resolve — só os que já tiveram o primeiro lote rodado caem nessa armadilha.

## Correção

Tornar o `ActiveCampaignJobIndicator` ciente de jobs com lotes futuros agendados.

### 1. `src/components/ActiveCampaignJobIndicator.tsx`

- Ao buscar/avaliar o job ativo, considerar também a existência de `campaign_batches` com `status='scheduled'` e `scheduled_at > now()`.
- Se houver, o job NÃO é "travado", mesmo que `updated_at` esteja há >10min. O período entre lotes pode ser longo (30min, 1h, etc.).
- Em `autoResolveStuckJob`: antes de fechar, recheckar se existem batches `scheduled` futuros. Se existirem, abortar a auto-resolução. Quando realmente fechar, NÃO marcar batches `scheduled` como failed — apenas `pending`/`processing`.
- Esconder o indicador (estado "Disparando X%") enquanto o job estiver entre lotes (sem batch em `processing`). Mostrar uma variante discreta "Programado para HH:MM" ou simplesmente ocultar até o próximo lote começar.

### 2. `process-campaign-job/index.ts` (defensivo, opcional pequeno)

Quando ainda há `scheduledLeft > 0`, além de atualizar `updated_at`, voltar o job para `status='scheduled'` (em vez de manter `processing`). Isso:
- Faz o `ActiveCampaignJobIndicator` ignorar naturalmente (já filtra apenas `pending`/`processing`).
- Evita que qualquer outro consumidor confunda "executando agora" com "aguardando próximo lote".

Essa segunda mudança é a mais limpa, mas exige que outros locais que dependem de `processing` (ex.: progresso) sigam consultando o job certo. Vou auditar usos antes de aplicar.

## Saneamento dos jobs atuais

Job f4cdddc4 ainda está vivo (lote 1 vai rodar 16:00). Não precisa intervenção manual se a correção for aplicada antes das 15:40. Se passar disso, rodar:

```sql
UPDATE campaign_jobs
SET status='scheduled', completed_at=NULL, error_message=NULL
WHERE id='f4cdddc4-e2a9-4f1a-9c28-182df1aebfaf'
  AND status='completed'
  AND EXISTS (
    SELECT 1 FROM campaign_batches
    WHERE job_id=campaign_jobs.id AND status='scheduled' AND scheduled_at > now()
  );

UPDATE campaign_batches
SET status='scheduled', error_log=NULL
WHERE job_id='f4cdddc4-e2a9-4f1a-9c28-182df1aebfaf'
  AND status='failed'
  AND scheduled_at > now()
  AND error_log ILIKE '%timeout%';
```

## O que NÃO alterar

- Lógica de `process-campaign-job` que avança batches.
- `scheduled-campaign-dispatcher`.
- Constraints / schema.
- Lógica de criação de jobs/batches em `EventoBase.tsx`.

## Risco

Baixo. Mudança restrita ao componente de indicador (frontend) + opcionalmente um único update de status no edge function. Sem migrações.

## Testes

1. Programar disparo com >1 lote e intervalo de 30min — após o primeiro lote rodar, indicador NÃO deve marcar como travado, e o próximo lote deve rodar normalmente no horário.
2. Disparo imediato único — continua marcando travado após 10min de fato sem progresso.
3. Cancelar disparo programado — continua funcionando.
