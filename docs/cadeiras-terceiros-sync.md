# Sincronização de Cadeiras de Terceiros (`external_access_seats` ↔ `profiles.is_active`)

## Contexto

Erro `409 Conflict` em `POST /functions/v1/manage-users` ao criar terceiro na EMPRESA ADMIN.

**Causa raiz:** dessincronização entre `profiles.is_active` e `external_access_seats.status`.
- Limite de cadeiras = 5
- 5 seats `status='active'`, mas 4 perfis estavam `is_active=false` (julia, juia, maria costa, carol)
- `set_external_active(false)` só mexia em `profiles.is_active` — o seat continuava `active` e ocupava slot
- A contagem do limite (`manage-users`) filtra `status='active'`, então cadeiras de terceiros desativados bloqueavam novas criações

## Correções aplicadas

### 1. Edge function `supabase/functions/manage-users/index.ts`

**`set_external_active`** agora:
- Atualiza `profiles.is_active` **e** `profiles.status` (`'Ativo'` / `'Inativo'`) em sincronia
- Se `is_active=false`: faz `UPDATE external_access_seats SET status='revoked'` no seat ativo do perfil → libera o slot
- Se `is_active=true`: tenta reativar o último seat **apenas se**:
  - o evento (`prospeccao_id`) ainda é válido (não expirado, `snapshot_realizado=false`), e
  - há slot disponível no limite da empresa
  - caso contrário, mantém `revoked` e devolve mensagem orientando usar "Renovar"
- Registra em `logs_cadeiras.metadata` os `seat_ids` afetados e a ação tomada

**`renew_external_seat`** agora também seta `profiles.status='Ativo'` (antes só mexia em `is_active`).

### 2. Backfill (migration de dados)

```sql
-- Liberou 4 slots na EMPRESA ADMIN e qualquer outra empresa no mesmo estado
UPDATE external_access_seats s
SET status='revoked', updated_at=now()
FROM profiles p
WHERE s.profile_id = p.id
  AND s.status = 'active'
  AND p.is_external = true
  AND p.is_active = false;

-- Alinhou status textual de 3 perfis
UPDATE profiles
SET status='Inativo'
WHERE is_external=true AND is_active=false AND status='Ativo';
```

### 3. Validação pós-backfill (EMPRESA ADMIN)

- Seats `active`: **1** (só maria da silva)
- Seats `revoked`: **4**
- Slot 2/5 disponível para novos terceiros

## O que NÃO foi alterado

- Schema de `external_access_seats` (sem novas colunas/constraints)
- `get_seats_limit`, RLS, `create_external`
- UI `/cadeiras` (sincronização passou a ser server-side)
- Login gate `can_user_login` (continua em `is_active`)

---

## Overview: como funciona a desativação por data?

**Não há cron diário específico para cadeiras.** A desativação automática acontece em duas camadas independentes:

### Camada 1 — `cron.job` `encerrar-eventos-finalizados` (06:00 diariamente)

```
0 6 * * *  →  SELECT public.encerrar_eventos_finalizados(50, NULL, false);
```

Para cada `prospeccoes` com `data_fim < hoje` e `snapshot_realizado=false`:
1. Cria snapshot em `evento_snapshot_leads`
2. Descarta leads não finalizados (`status='Descartado'`), exceto se vinculados a outro evento ativo
3. Marca `snapshot_realizado=true` + `encerrado_at=now()`

**Importante:** esse cron **não toca em `external_access_seats` nem em `profiles.is_active`.** Ele apenas "encerra o evento". A cadeira do terceiro continua `active` e o terceiro continua conseguindo logar — até que alguém:
- desative manualmente o terceiro em `/cadeiras` (`set_external_active(false)`) → revoga o seat, OU
- tente reativar um terceiro cujo evento já foi encerrado → a edge agora bloqueia a reativação do seat e orienta "Renovar"

### Camada 2 — Ações manuais via `manage-users` (síncronas)

| Ação UI | Branch edge | Efeito em `is_active` | Efeito em `external_access_seats` |
|---|---|---|---|
| Desativar terceiro | `set_external_active(false)` | `false` + `status='Inativo'` | seat ativo → `revoked` (libera slot) |
| Reativar terceiro | `set_external_active(true)` | `true` + `status='Ativo'` | reativa seat **se** evento válido e slot disponível |
| Renovar cadeira | `renew_external_seat` | `true` + `status='Ativo'` | cria/atualiza seat para novo evento |
| Criar terceiro | `create_external` | `true` + `status='Ativo'` | cria seat `active` (conta no limite) |

### Cron job recomendado (não implementado)

Hoje, quando um evento encerra às 06:00, os terceiros vinculados **continuam logando** com seats `active` ocupando slots. Se isso for um problema, criar um job complementar:

```sql
-- Pseudo: ao encerrar evento, revogar seats e desativar profiles dos terceiros
UPDATE external_access_seats SET status='revoked'
WHERE prospeccao_id IN (SELECT id FROM prospeccoes WHERE snapshot_realizado=true)
  AND status='active';

UPDATE profiles SET is_active=false, status='Inativo'
WHERE id IN (SELECT profile_id FROM external_access_seats WHERE status='revoked')
  AND is_external=true AND is_active=true;
```

**Decisão atual:** desativação fica manual via `/cadeiras`. A edge garante consistência sempre que o admin desativar/reativar.

## Testes recomendados

1. EMPRESA ADMIN: criar novo terceiro → sucesso (slot 2/5) ✅
2. Desativar terceiro em `/cadeiras` → seat vira `revoked`, slot liberado, `/administracao/acessos` mostra Inativo
3. Reativar terceiro com evento válido → seat volta a `active`
4. Reativar terceiro com evento encerrado → mensagem orientando renovar
5. Renovar cadeira → sem regressão

## Rollback

Reverter edge function + `UPDATE external_access_seats SET status='active'` nos ids logados em `logs_cadeiras` durante o backfill.
