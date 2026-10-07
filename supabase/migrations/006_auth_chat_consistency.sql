-- Keep Supabase auth users and Kilix public profiles in sync after the database rebuild.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := 'KX-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 10));
BEGIN
  INSERT INTO public.users (
    auth_id, user_code, email, first_name, last_name, phone, country, account_type
  ) VALUES (
    NEW.id,
    v_code,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'first_name', ''),
    coalesce(NEW.raw_user_meta_data->>'last_name', ''),
    nullif(NEW.raw_user_meta_data->>'phone', ''),
    coalesce(NEW.raw_user_meta_data->>'country', 'DZ'),
    coalesce(NEW.raw_user_meta_data->>'account_type', 'buyer')
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = CASE WHEN public.users.first_name = '' THEN EXCLUDED.first_name ELSE public.users.first_name END,
    last_name = CASE WHEN public.users.last_name = '' THEN EXCLUDED.last_name ELSE public.users.last_name END,
    phone = coalesce(public.users.phone, EXCLUDED.phone),
    country = coalesce(public.users.country, EXCLUDED.country),
    account_type = coalesce(public.users.account_type, EXCLUDED.account_type),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.users (auth_id, user_code, email, first_name, last_name, phone, country, account_type)
SELECT
  au.id,
  'KX-' || upper(substr(replace(au.id::text, '-', ''), 1, 10)),
  au.email,
  coalesce(au.raw_user_meta_data->>'first_name', ''),
  coalesce(au.raw_user_meta_data->>'last_name', ''),
  nullif(au.raw_user_meta_data->>'phone', ''),
  coalesce(au.raw_user_meta_data->>'country', 'DZ'),
  coalesce(au.raw_user_meta_data->>'account_type', 'buyer')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.auth_id = au.id
)
ON CONFLICT (auth_id) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.open_store_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_update_order_status(uuid, text) TO authenticated;
