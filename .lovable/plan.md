

# Plan: Tratamento Automático de Template Pausado pela Meta (IA WhatsApp)

## Key Clarifications Incorporated

1. **Templates are shared across companies** via the same `pri_telefone` (agent phone). The `whatsapp_templates` table has per-empresa rows but they share the same `id_meta`. When Meta pauses a template, ALL empresas using that `id_meta` are affected.
2. **Reset endpoint works lead-by-lead** using `lead_id` (serial integer), not UUID lists. Matches the dispatch payload pattern: `"lead_id": "191988"`.

---

## Database Changes

### Migration 1: New table + new column

```sql
-- Track paused templates and their replacements
CREATE TABLE public.template_pausado_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_meta_original text NOT NULL,
  template_original_id uuid REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  template_duplicado_id uuid REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_duplicate',
  -- CHECK via trigger: pending_duplicate, awaiting_approval, approved_linked, failed
  eventos_impactados jsonb NOT NULL DEFAULT '[]',
  -- Array of {prospeccao_id, empresa_id, campo}
  pri_telefone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.template_pausado_log ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions)
CREATE POLICY "Service role full access" ON public.template_pausado_log
  FOR ALL USING (true) WITH CHECK (true);

-- New column on prospeccoes
ALTER TABLE public.prospeccoes
  ADD COLUMN IF NOT EXISTS disparos_pausados boolean DEFAULT false;
```

---

## Edge Functions

### 1. `template-paused-webhook` (verify_jwt = false)

**Input:** `{ id_meta: string }`

**Flow:**
1. Find ALL `whatsapp_templates` rows with this `id_meta` (across all empresas sharing the same agent phone)
2. Update their `status_meta` to `'PAUSED'`
3. For each template found, find ALL `prospeccoes` where `canal = 'IA WhatsApp'` AND any template field (`template_prospeccao_id`, `template_agendado_id`, `template_nao_agendado_id`, `template_agendado_48h_id`, `template_agendado_24h_id`) references that template UUID
4. For each affected prospeccao:
   - NULL out the matching template field(s)
   - SET `disparos_pausados = true`
   - Record `{prospeccao_id, empresa_id, campo}` in `eventos_impactados`
5. Cancel active `campaign_jobs` (status in pending/processing) for those prospeccoes → sets status to `cancelled` which stops batch processing at the next iteration
6. Check `template_pausado_log` for existing entry with same `id_meta_original` and status `pending_duplicate` or `awaiting_approval`:
   - If exists → reuse, skip duplication
   - If not → duplicate template: copy content/format/card_data/variable_mapping, name it `{nome}_v2` (increment if exists), insert into `whatsapp_templates` for each affected empresa, call `external-webhook-proxy` with `novo_template_whatsapp` gatilho to register on Meta
7. Save log entry in `template_pausado_log`

### 2. `reset-disparos-pendente` (verify_jwt = false)

**Input:** `{ lead_id: number, prospeccao_id: string }`

Single lead reset, matching the dispatch pattern.

**Flow:**
1. Find `contatos` row by `lead_id` (serial)
2. SET `data_disparo_ia = NULL` on `contatos` where `lead_id = input.lead_id`
3. SET `data_disparo_ia = NULL` on `eventos_prospeccao` where `contato_id = found_contato.id AND prospeccao_id = input.prospeccao_id`
4. Return `{ success: true, lead_id, reset: true }`

---

## Frontend Changes

### 3. `EventoBase.tsx` - Warning Banner + Dispatch Block

- Add `disparos_pausados` to the prospeccao select query
- When `disparos_pausados === true`, render an alert banner with the specified text
- Disable the dispatch button when `disparos_pausados` is true
- No other changes to EventoBase

### 4. `Templates.tsx` - Auto-link on Approval

In the existing `handleUpdateStatusMeta` loop, after updating a template's status to `APPROVED`:
- Query `template_pausado_log` where `template_duplicado_id` matches the approved template and status = `awaiting_approval`
- For each match:
  - Iterate `eventos_impactados`, SET the correct template field on each prospeccao
  - SET `disparos_pausados = false` on those prospeccoes
  - Update log status to `approved_linked`

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/...` | Create table + add column |
| `supabase/functions/template-paused-webhook/index.ts` | Create |
| `supabase/functions/reset-disparos-pendente/index.ts` | Create |
| `supabase/config.toml` | Add 2 function configs |
| `src/pages/prospeccao/EventoBase.tsx` | Add banner + block dispatch |
| `src/pages/prospeccao/Templates.tsx` | Add auto-link logic in status sync |

## Multi-empresa Template Handling

Since templates share `id_meta` across empresas (same PRI phone):
- The webhook finds ALL template rows by `id_meta` (not filtered by empresa)
- Duplicates are created per-empresa (each empresa gets its own copy)
- The `eventos_impactados` array stores `empresa_id` alongside `prospeccao_id` and `campo` for precise re-linking

