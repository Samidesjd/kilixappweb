CREATE OR REPLACE FUNCTION public.get_public_user_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint FROM public.users;
$$;

REVOKE ALL ON FUNCTION public.get_public_user_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_user_count() TO anon, authenticated;
