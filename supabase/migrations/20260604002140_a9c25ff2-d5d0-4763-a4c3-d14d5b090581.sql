-- Habilita login_terceiros_cadeiras apenas para EMPRESA ADMIN
INSERT INTO public.feature_flag_empresas (flag_id, empresa_id, is_enabled)
SELECT f.id, 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid, true
FROM public.system_feature_flags f
WHERE f.flag_key = 'login_terceiros_cadeiras'
ON CONFLICT (flag_id, empresa_id) DO UPDATE SET is_enabled = true;