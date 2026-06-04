## Problema

`POST manage-users` → 409 ao criar terceiro na EMPRESA ADMIN.

Causa real (confirmada no banco):
- Limite de cadeiras = 5
- 5 seats `status='active'` na empresa, mas **4 perfis estão `is_active=false`** (julia, juia, maria costa, carol)
- `set_external_active(is_active=false)` só atualiza `profiles.is_active` — não toca `external_access_seats.status` → slot continua ocupado
- A contagem do limite (`manage-users` linha 724-728) filtra `seat.status='active'`, então cadeiras de terceiros desativados continuam bloqueando

A edge function não parou; está retornando 409 corretamente segundo a lógica atual.

## Correção (3 partes)

### 1. Edge function `manage-users` — sincronizar seat ao desativar/reativar
No case `set_external_active`:
- Se `is_active=false` → também `UPDATE external_access_seats SET status='revoked' WHERE profile_id=? AND status='active'`
- Se `is_active=true` → reativar a cadeira correspondente apenas se o evento (`prospeccao_id`) ainda estiver válido (ativo, dentro do `data_fim`, sem snapshot); caso contrário manter `revoked` e devolver mensagem orientando usar "Renovar"
- Registrar a mudança no `logs_cadeiras.metadata` (seat_ids afetados)

### 2. Backfill (migration de dados)
`UPDATE external_access_seats SET status='revoked' WHERE status='active' AND profile_id IN (SELECT id FROM profiles WHERE is_external=true AND is_active=false)`
- Libera os 4 slots da EMPRESA ADMIN imediatamente
- Aplica também em outras empresas que estejam no mesmo estado inconsistente

### 3. Alinhar `profiles.status` ao `is_active` (do plano anterior)
- No `set_external_active`: também setar `status = is_active ? 'Ativo' : 'Inativo'`
- No `renew_external_seat`: também setar `status='Ativo'`
- Backfill: `UPDATE profiles SET status='Inativo' WHERE is_external=true AND is_active=false AND status='Ativo'`
- UI defensiva em `/administracao/acessos` (badge e filtro) — tratar `is_active=false` como Inativo mesmo se status divergir

## O que NÃO alterar
- Schema de `external_access_seats` (sem novas colunas/constraints)
- `get_seats_limit`, RLS, fluxo de criação (`create_external`)
- `/cadeiras` UI — continua chamando `set_external_active`; a sincronização passa a ser server-side
- Login gate (`can_user_login`) — continua em `is_active`

## Testes obrigatórios
1. EMPRESA ADMIN após backfill: contagem de seats ativos = 1 (só maria da silva)
2. Criar novo terceiro na EMPRESA ADMIN → sucesso (slot 2/5)
3. Desativar terceiro em `/cadeiras` → seat vira `revoked`, slot liberado, `/administracao/acessos` mostra Inativo
4. Reativar terceiro com evento válido → seat volta a `active`, slot ocupa
5. Reativar terceiro com evento expirado → mensagem orientando renovar; seat permanece `revoked`
6. Renovar cadeira existente → segue funcionando (sem regressão)

## Riscos
- Baixo. Mudança escopada a terceiros (`is_external=true`). Nenhuma alteração em RLS/schema.
- Rollback: reverter edge function + `UPDATE external_access_seats SET status='active'` nos ids logados pelo backfill (capturar lista antes via SELECT).
