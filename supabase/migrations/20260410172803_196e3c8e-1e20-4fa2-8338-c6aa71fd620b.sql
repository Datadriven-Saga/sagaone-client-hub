
-- Drop ALL existing signatures of get_quarentena_paginated
DROP FUNCTION IF EXISTS public.get_quarentena_paginated(uuid, text, text[], text[], text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_quarentena_paginated(uuid, text, text[], text[], text, text, text, text, text, integer, integer, text);
