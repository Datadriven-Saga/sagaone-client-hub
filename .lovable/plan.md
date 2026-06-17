
# Mudar janela de disparo de 07–22 para 07–20

Alterar o limite superior da janela permitida em todas as camadas (UI, edge dispatcher e doc).

## Arquivos

### 1. `src/components/ProgramarDisparoModal.tsx`
- `JANELA_FIM_H = 22` → `20`.
- Substituir as strings literais `"07:00–22:00"` (linhas 162, 189, 224) por `"07:00–20:00"`.
- A função `buildSlots` já é derivada de `JANELA_FIM_H`; o último slot passa a ser `20:00` (sem `20:30`, pelo `if (h !== JANELA_FIM_H)`).
- `isWithinWindow` continua válida — proíbe minutos > 0 na hora final (ou seja, `20:30+` fica fora).

### 2. `supabase/functions/scheduled-campaign-dispatcher/index.ts`
- `WINDOW_END_H = 22` → `20`.
- Atualizar o comentário `// último slot permitido 22:00 (inclusivo)` → `20:00`.
- `isInsideWindow` e `nextWindowStart` permanecem (são derivados das constantes).
- Comportamento: batches reivindicados após 20:00 são silenciosamente reagendados para 07:00 do dia útil seguinte.

### 3. `docs/fluxo-disparo-whatsapp.md`
- Substituir todas as menções `07–22`, `07:00–22:00`, `22:00` (no contexto da janela) por `07–20`, `07:00–20:00`, `20:00`.
- Linhas afetadas: 168, 344, 363, 371, 373, 494, 525 (e qualquer outra menção residual).

## Fora de escopo

- Nenhuma migração SQL.
- Sem mudança em `WINDOW_START_H` (continua 07).
- Sem mudança no cron (continua rodando 24h; a edge é quem enforça a janela).
- Sem mudança em jobs já agendados entre 20:01 e 22:00: ao serem reivindicados, o dispatcher os reagenda automaticamente para o próximo 07:00 (comportamento já existente). Não é necessário migrar `scheduled_at` retroativamente — se o usuário quiser executar hoje, pode reabrir e reagendar.

## Verificação

- Tentar programar 20:30 na UI → bloqueado.
- Tentar programar 20:00 → aceito.
- Forçar inserção de batch com `scheduled_at = 21:00` e observar o próximo tick do `scheduled-campaign-dispatcher`: deve reagendar para 07:00 do dia seguinte com `locked_at`/`locked_by` limpos, sem disparar a Lambda.
