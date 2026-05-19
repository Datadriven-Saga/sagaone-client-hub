UPDATE public.prospeccoes
SET data_fim = now() - interval '1 day', updated_at = now()
WHERE id = 'aab16a3b-c389-4067-a9f7-843467dd7dfb' AND snapshot_realizado = false;
SELECT * FROM public.encerrar_eventos_finalizados(50, 'aab16a3b-c389-4067-a9f7-843467dd7dfb'::uuid, false);