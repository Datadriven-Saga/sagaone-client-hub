-- Passo 1: backfill agente_id via pri_telefone
UPDATE public.whatsapp_templates wt
SET agente_id = a.id
FROM public.agentes_ia a
WHERE wt.agente_id IS NULL
  AND wt.pri_telefone IS NOT NULL
  AND a.telefone = wt.pri_telefone;

-- Passo 2: renomear TODAS as duplicatas intra-agente (mantendo o mais recente com o nome original)
WITH dupes AS (
  SELECT id,
         nome,
         ROW_NUMBER() OVER (
           PARTITION BY agente_id, LOWER(nome) ORDER BY created_at DESC
         ) AS rn
  FROM public.whatsapp_templates
  WHERE agente_id IS NOT NULL
)
UPDATE public.whatsapp_templates wt
SET nome = wt.nome || '_legacy_' || substr(wt.id::text, 1, 8)
FROM dupes d
WHERE wt.id = d.id AND d.rn > 1;

-- Passo 3: trocar índice único (empresa -> agente)
DROP INDEX IF EXISTS public.idx_whatsapp_templates_nome_empresa;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_templates_nome_agente
ON public.whatsapp_templates (agente_id, LOWER(nome))
WHERE agente_id IS NOT NULL;