CREATE OR REPLACE FUNCTION public.delete_account_data(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_store_ids uuid[] := ARRAY[]::uuid[];
  v_product_ids uuid[] := ARRAY[]::uuid[];
  v_owned_stores integer := 0;
  v_deleted_orders integer := 0;
  v_deleted_products integer := 0;
BEGIN
  IF p_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]), COUNT(*)::integer INTO v_store_ids, v_owned_stores FROM public.stores WHERE owner_id = p_uid;
  IF cardinality(v_store_ids) > 0 THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_product_ids FROM public.products WHERE store_id = ANY(v_store_ids);
  END IF;
  DELETE FROM public.coupons WHERE user_id = p_uid;
  DELETE FROM public.notifications WHERE user_id = p_uid;
  DELETE FROM public.notification_settings WHERE user_id = p_uid;
  DELETE FROM public.store_followers WHERE user_id = p_uid;
  DELETE FROM public.merchant_payments WHERE owner_id = p_uid;
  DELETE FROM public.push_tokens WHERE user_id = p_uid;
  DELETE FROM public.chats WHERE participant_1_id = p_uid OR participant_2_id = p_uid;
  IF v_email IS NOT NULL THEN DELETE FROM public.account_deletion_requests WHERE lower(email) = lower(v_email); END IF;
  DELETE FROM public.orders WHERE user_id = p_uid;
  GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;
  IF cardinality(v_store_ids) > 0 THEN
    UPDATE public.orders SET store_id = NULL, product_id = NULL WHERE store_id = ANY(v_store_ids);
  END IF;
  IF cardinality(v_product_ids) > 0 THEN
    UPDATE public.order_reviews SET product_id = NULL WHERE product_id = ANY(v_product_ids);
    DELETE FROM public.products WHERE id = ANY(v_product_ids);
    GET DIAGNOSTICS v_deleted_products = ROW_COUNT;
  END IF;
  IF cardinality(v_store_ids) > 0 THEN DELETE FROM public.stores WHERE id = ANY(v_store_ids); END IF;
  DELETE FROM public.users WHERE auth_id = p_uid;
  RETURN jsonb_build_object('success', true, 'owned_stores', v_owned_stores, 'deleted_products', v_deleted_products, 'deleted_buyer_orders', v_deleted_orders);
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_account_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_account_data(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN public.delete_account_data(auth.uid());
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated, service_role;
