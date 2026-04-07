-- Drop old bulk_upsert_contatos (3 params, without p_canal)
DROP FUNCTION IF EXISTS public.bulk_upsert_contatos(jsonb, uuid, uuid);

-- Drop old check_quarentena (2 params, without p_canal)
DROP FUNCTION IF EXISTS public.check_quarentena(text[], uuid);

-- Drop old upsert_quarentena (5 params, without p_canal)
DROP FUNCTION IF EXISTS public.upsert_quarentena(text, uuid, uuid, text, timestamptz);

-- Drop old get_quarentena_paginated (11 params, without p_canal)
DROP FUNCTION IF EXISTS public.get_quarentena_paginated(uuid, text, text[], uuid[], text, timestamptz, timestamptz, text, text, integer, integer);