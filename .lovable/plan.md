## Objetivo

Trocar a unicidade de templates de WhatsApp de **"por empresa"** para **"por agente"**, permitindo que dois agentes da mesma empresa (ex.: Pri e Paty) tenham templates com o mesmo `nome`.

---

## Regra nova

- Um mesmo `nome` (case-insensitive) pode existir várias vezes na empresa, **desde que em agentes diferentes**.
- Dentro do mesmo `agente_id`, o `nome` continua único.
- Templates sem `agente_id` (legado) ficam sem constraint — comportamento aceito, com backfill parcial antes.

---

## Migration SQL (uma migration só)

**Passo 1 — Backfill de `agente_id` via `pri_telefone`:**

```sql
UPDATE public.whatsapp_templates wt
SET agente_id = a.id
FROM public.agentes_ia a
WHERE wt.agente_id IS NULL
  AND wt.pri_telefone IS NOT NULL
  AND a.telefone = wt.pri_telefone;
```

Cobre ~10 telefones dos 157 órfãos. Resto permanece NULL.

**Passo 2 — Resolver a duplicata existente** (`operacao_de_guerra_pm_maio`, mesmo agente, 2 linhas — manter mais recente):

```sql
DELETE FROM public.whatsapp_templates
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY agente_id, LOWER(nome) ORDER BY created_at DESC
    ) rn
    FROM public.whatsapp_templates
    WHERE agente_id IS NOT NULL
  ) s WHERE rn > 1
);
```

**Passo 3 — Trocar o índice:**

```sql
DROP INDEX IF EXISTS public.idx_whatsapp_templates_nome_empresa;

CREATE UNIQUE INDEX idx_whatsapp_templates_nome_agente
ON public.whatsapp_templates (agente_id, LOWER(nome))
WHERE agente_id IS NOT NULL;
```

`WHERE agente_id IS NOT NULL` deixa órfãos livres explicitamente (Postgres já não deduplica NULL, mas o filtro documenta a intenção e reduz tamanho do índice).

---

## Ajustes de código

**`src/pages/pos-vendas/TemplatesPaty.tsx`** — `handleSincronizarTemplate` (~L1678):

Trocar o pré-check UPDATE-vs-INSERT para filtrar por agente e usar match case-insensitive:

```ts
.from("whatsapp_templates")
.select("id, template_id_pri, id_meta")
.eq("agente_id", selectedAgenteId)
.ilike("nome", nome)          // bate com o LOWER() do índice
.maybeSingle();
```

**Auditar callers** para garantir que ninguém procura template por `(empresa_id, nome)` assumindo unicidade global da empresa. A ser lido e corrigido apenas se houver assunção incorreta:

- `src/pages/prospeccao/Templates.tsx` (insert + fluxo de criação)
- `src/pages/pos-vendas/TemplatesPaty.tsx` (handleSave, além do handleSincronizarTemplate)
- `src/components/CriarTemplateInline.tsx` (insert)
- `src/components/CriarProspeccaoModal.tsx` (seleção de template)
- `src/hooks/pos-vendas/usePosVendasData.ts` (listagem)
- `supabase/functions/template-paused-webhook/index.ts` (duplica templates pausados)
- `supabase/functions/process-campaign-job/index.ts` e `dispatch-leads-webhook/index.ts` (resolvem template para disparo)

Se a busca for por `id`, `id_meta` ou `template_id_pri`, **nenhuma mudança necessária**. Só quem procura por `nome` dentro de `empresa_id` sem `agente_id` precisa passar a filtrar por agente também.

---

## Impacto

**Confirmado:**
- 0 colisões cross-agente hoje → nenhuma linha bloqueia a criação do índice novo.
- 1 duplicata intra-agente resolvida pelo passo 2.
- Padrão de insert desde fev/2026 já popula `agente_id` → constraint nova cobre 100% dos novos templates.
- Coerente com a Meta (unicidade por WABA/agente).

**Riscos:**
- Callers que resolvem template por `(empresa_id, nome)` sem `agente_id` podem passar a bater em várias linhas — daí a auditoria acima.
- Órfãos legados (~149 após backfill) ficam sem proteção. Aceito.

**Rollback:**
- `DROP INDEX idx_whatsapp_templates_nome_agente;`
- Recriar `idx_whatsapp_templates_nome_empresa` (só se não houver duplicatas cross-agente criadas nesse meio-tempo).

---

## O que NÃO alterar

- Coluna `agente_id` continua nullable (não fazer `NOT NULL` agora — quebraria os 149 órfãos restantes).
- Não mexer em `pri_telefone`, webhooks n8n, nem no fluxo `criar-template-pri-from-meta`.
- Não mexer em RLS de `whatsapp_templates`.

---

## Testes obrigatórios pós-deploy

1. Criar template `boas_vindas` no agente Pri → OK.
2. Criar `boas_vindas` no agente Paty da **mesma empresa** → **agora deve passar** (antes falhava).
3. Criar `boas_vindas` de novo no agente Pri → deve falhar com 23505 (comportamento esperado).
4. Sincronizar template da Meta via `handleSincronizarTemplate`: cenário INSERT novo, cenário UPDATE de existente, cenário Meta devolve `nome` em case diferente do local (deve fazer UPDATE, não INSERT).
5. Webhook `template-paused-webhook` continua duplicando template pausado sem colidir.
6. Disparo de campanha (`process-campaign-job`) continua achando o template correto.
