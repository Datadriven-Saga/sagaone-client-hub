

# Plan: Register All Dispatch Actions in logs_disparos

## Current State
Only bulk dispatches ("Disparar Todos" / "Disparar X") log to `logs_disparos` via `DispararCustoModal`. Three other dispatch actions do NOT log:

1. **Individual dispatch** (`handleDispararContato`) - dispatches 1 lead
2. **Individual redispatch** (`handleRedispararContato`) - redispatches 1 lead  
3. **Redisparar Todos** (`handleRedisparoEmMassa`) - resets all dispatched leads to pending

## Changes

### 1. Create a shared logging helper function in EventoBase.tsx

Add a `registrarLogDisparo` helper inside the component that inserts into `logs_disparos` with user info, event name, channel, and lead count. It will fetch the user profile data and dollar exchange rate (reusing the existing `cotacao-dolar` edge function), then insert the log record. For individual dispatches (1 lead), the cost fields will be calculated the same way as the modal does.

### 2. Add logging to `handleDispararContato` (individual dispatch)

After the successful dispatch (after `toast({ title: "Sucesso"... })`), call `registrarLogDisparo` with `total_contatos: 1`.

### 3. Add logging to `handleRedispararContato` (individual redispatch)

After the successful redispatch, call `registrarLogDisparo` with `total_contatos: 1`.

### 4. Add logging to `handleRedisparoEmMassa` (bulk reset + redispatch)

After the successful reset, call `registrarLogDisparo` with `total_contatos: metricas.disparados` (the count of leads that were reset to pending).

## File Modified
- `src/pages/prospeccao/EventoBase.tsx` - add helper function + 3 logging calls

## Technical Details

The helper will:
- Fetch user profile (nome_completo, tipo_acesso) from `profiles`
- Fetch dollar exchange rate from `cotacao-dolar` edge function
- Calculate costs using the same constants as `DispararCustoModal` (USD $0.06 for WhatsApp, R$1.15 for Ligação)
- Insert into `logs_disparos` with all required fields
- Fire-and-forget (errors logged to console but don't block the dispatch)

