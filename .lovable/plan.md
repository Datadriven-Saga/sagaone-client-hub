

## Plan: Add Canal Selection + is_teste Toggle to Event Creation, and Send is_teste in Webhooks

### Summary

Three changes:
1. Add a **canal de prospecção** selector (WhatsApp / Ligação) on the "Dados Gerais" step for **Prospecção Mensal** and **Grande Evento** types, with a tooltip explaining quarantine implications
2. Add an **is_teste** toggle on "Dados Gerais" for **all event types** (currently not exposed in UI at all despite existing in the DB)
3. Ensure **is_teste** is included in webhook payloads for IA WhatsApp and IA Ligação

### Technical Details

#### File: `src/components/CriarProspeccaoModal.tsx`

**1. New state for canal_quarentena:**
- Add state: `const [canalQuarentena, setCanalQuarentena] = useState<'whatsapp' | 'ligacao'>('whatsapp')`
- Add state: `const [isTeste, setIsTeste] = useState(false)`
- Populate from `editingProspeccao` when editing (map from existing `canal_quarentena` and `is_teste` fields)
- Include in `clearForm()`

**2. UI additions in "Dados Gerais" step (after tipo evento selector, before dates):**

For **Prospecção Mensal** and **Grande Evento** only:
- Add a `Select` for "Canal de Prospecção" with options "WhatsApp" and "Ligação"
- Add a `Tooltip` explaining: "Os contatos desta prospecção entrarão em quarentena para o canal selecionado. WhatsApp: 20 dias / Ligação: 30 dias após o fim do evento."

For **all event types**:
- Add a `Switch` toggle for "Evento de Teste" with tooltip: "Eventos de teste não geram quarentena para os contatos."
- For IA WhatsApp and IA Ligação, the canal is implicit (whatsapp/ligacao respectively), so the canal selector is hidden

**3. Save canal_quarentena in dadosProspeccao:**
- For Prospecção Mensal / Grande Evento: use the selected `canalQuarentena` value
- For IA WhatsApp: always `'whatsapp'`
- For IA Ligação: always `'ligacao'`
- Save `is_teste` for all types: `dadosProspeccao.is_teste = isTeste`

**4. Send is_teste in webhook payloads:**

- **callWebhook** (pri-config for IA WhatsApp): add `is_teste: prospeccaoData.is_teste ?? false` to `webhookPayload`
- **triggerNovoEventoCriadoWebhooks** (novo_evento_criado): add `is_teste: prospeccaoData.is_teste ?? false` to `payload` (already sends for all types)
- **callIALigacaoWebhooks** (ia-ligacao-webhook): add `is_teste: prospeccaoData.is_teste ?? false` to `eventoParaEdge`

#### Database Migration

- Add column `canal_quarentena` to `prospeccoes` table:
  ```sql
  ALTER TABLE prospeccoes ADD COLUMN IF NOT EXISTS canal_quarentena text
    CHECK (canal_quarentena IN ('whatsapp', 'ligacao'));
  ```
- Backfill existing data based on `canal`:
  - `'Whatsapp'` → `'whatsapp'`
  - `'Ligação'` → `'ligacao'`
  - `'Mensal'` → `'whatsapp'`
  - `'Grande Evento'` → `'whatsapp'`

### Files Changed

| File | Change |
|---|---|
| `src/components/CriarProspeccaoModal.tsx` | Add canal selector, is_teste toggle, update payloads |
| New migration SQL | Add `canal_quarentena` column to `prospeccoes` |

### What stays unchanged

- All other pages, components, and edge functions
- Existing quarantine logic (already uses `is_teste` from DB)
- RLS policies

