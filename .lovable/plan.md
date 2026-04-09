

## Plan: Add Team Membership Filter to Kanban and Auto-Attribution

### Context

Tables: `prospeccao_equipes` (id, prospeccao_id) → `prospeccao_equipe_membros` (equipe_id, user_id). A user must be a member of at least one team linked to the lead's event (`prospeccao_id`) to see or receive that lead.

### Changes (one migration, two functions)

#### 1. `get_kanban_columns_limited`

Add the following `EXISTS` clause to **all 8 queries** (4 branches x COUNT + SELECT):

```sql
AND EXISTS (
  SELECT 1 FROM prospeccao_equipes eq
  JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
  WHERE eq.prospeccao_id = ep.prospeccao_id
    AND em.user_id = auth.uid()
)
```

This applies to:
- **Novo column** (with/without `p_prospeccao_id`) — already has the canal filter, now also requires team membership
- **Other columns** (with/without `p_prospeccao_id`) — leads assigned to the user will only show if the user is in the event's team

#### 2. `auto_atribuir_leads_vendedor`

Add the same `EXISTS` clause to the `leads_disponiveis` CTE, using `user_id_param` instead of `auth.uid()`:

```sql
AND EXISTS (
  SELECT 1 FROM prospeccao_equipes eq
  JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
  WHERE eq.prospeccao_id = ep.prospeccao_id
    AND em.user_id = user_id_param
)
```

### Impact

- SDRs/Vendedores only see and receive leads from events where they belong to a team
- Leads already assigned but where the user is not in the event team will **stop appearing** (per the original instruction's expected behavior)
- Management profiles unchanged

