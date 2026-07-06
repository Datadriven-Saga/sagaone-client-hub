REVOKE ALL ON FUNCTION public.resolve_login_otp_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_login_otp_user(text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_login_otp_user(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_otp_user(text) TO service_role;

REVOKE ALL ON FUNCTION public.can_user_login(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_user_login(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_user_login(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_login(uuid, text) TO service_role;