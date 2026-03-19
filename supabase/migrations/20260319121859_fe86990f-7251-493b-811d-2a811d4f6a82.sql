
-- Create a wrapper function that limits "Novo" leads for SDR/Vendedor profiles
-- This enforces the 30-lead visibility limit at the database level
CREATE OR REPLACE FUNCTION public.get_kanban_columns_limited(
  p_empresa_id uuid,
  p_per_column integer DEFAULT 20,
  p_prospeccao_id uuid DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_user_tipo tipo_acesso;
  v_is_limited boolean := false;
  v_novo_limit integer;
BEGIN
  -- Check if user is SDR or Vendedor
  SELECT tipo_acesso INTO v_user_tipo
  FROM public.profiles
  WHERE id = auth.uid();
  
  v_is_limited := v_user_tipo IN ('SDR'::tipo_acesso, 'Vendedor'::tipo_acesso);
  
  -- For limited users, cap the "Novo" column items at 30
  -- For others, use the regular per_column limit
  v_novo_limit := CASE WHEN v_is_limited THEN LEAST(p_per_column, 30) ELSE p_per_column END;
  
  -- Call the original function
  v_result := get_kanban_columns(p_empresa_id, p_per_column, p_prospeccao_id, p_responsavel, p_search);
  
  -- For limited users, truncate the "Novo" items to 30 and cap the count
  IF v_is_limited AND v_result ? 'Novo' THEN
    v_result := jsonb_set(
      v_result,
      '{Novo}',
      jsonb_build_object(
        'count', LEAST((v_result->'Novo'->>'count')::integer, 30),
        'items', (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM (
            SELECT elem
            FROM jsonb_array_elements(v_result->'Novo'->'items') WITH ORDINALITY AS t(elem, ord)
            ORDER BY ord
            LIMIT 30
          ) sub
        )
      )
    );
  END IF;
  
  RETURN v_result;
END;
$$;
