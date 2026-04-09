

## Plan: Filter Kanban Leads by Event Type for SDR/Vendedor

### Understanding

The `prospeccoes.canal` field stores both the **type** of the event. The 4 values are:
- `'Grande Evento'` and `'Mensal'` — these should be visible to SDR/Vendedor
- `'Whatsapp'` and `'Ligação'` — these are IA events and should be **hidden** from SDR/Vendedor

**Key clarification from user**: Leads already attributed to the user must continue appearing regardless of event type. The filter only applies to:
1. The "Novo" column (unassigned leads)
2. The auto-attribution function

### Changes (one database migration, two functions)

#### 1. `get_kanban_columns_limited` — Visibility

**"Novo" column only**: Add filter to exclude leads linked exclusively to IA events:
```sql
AND p.canal IN ('Grande Evento', 'Mensal')
```
This applies to all 4 query blocks in the "Novo" branch (COUNT + SELECT, with/without `p_prospeccao_id`).

**Other columns (Atribuído, Em Espera, etc.)**: No change. These already filter by `responsavel_email = v_user_email`, so attributed leads continue showing regardless of event type.

#### 2. `auto_atribuir_leads_vendedor` — Auto-attribution

Add join to `eventos_prospeccao` + `prospeccoes` and filter:
```sql
INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id 
  AND pr.empresa_id = empresa_id_param
  AND pr.canal IN ('Grande Evento', 'Mensal')
```
Use `SELECT DISTINCT c.id` to avoid duplicates.

#### 3. No team filter

Per user clarification, this iteration only filters by event type — no team/equipe filter needed.

### What stays the same
- Management profiles (non-limited) — unchanged
- Already attributed leads in non-"Novo" columns — unchanged, keep appearing
- No frontend changes
- No retroactive data changes

