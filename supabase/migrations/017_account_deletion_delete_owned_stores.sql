-- Finalize in-app account deletion: explicitly remove every store owned by the
-- account. Existing CASCADE foreign keys remove the store's products,
-- followers, merchant payments and product-image embeddings. Seller references
-- in other buyers' orders are detached before this point so their history stays.

CREATE OR REPLACE FUNCTION public.delete_account_data(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_owned_stores integer := 0;
  v_deleted_orders integer := 0;
  v_deleted_products integer := 0;
BEGIN
  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  SELECT COUNT(*)::integer INTO v_owned_stores
  FROM public.stores
  WHERE owner_id = p_uid;

  -- Remove the account owner's buyer-side orders. Their reviews/coupons and
  -- related notifications follow the existing relationships/cleanup below.
  DELETE FROM public.orders WHERE user_id = p_uid;
  GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;

  -- Preserve other buyers' historical orders while detaching references to the
  -- seller that is about to be deleted.
  UPDATE public.orders o
  SET store_id = NULL,
      product_id = NULL
  WHERE o.store_id IN (
    SELECT s.id FROM public.stores s WHERE s.owner_id = p_uid
  );

  UPDATE public.order_reviews r
  SET product_id = NULL
  WHERE r.product_id IN (
    SELECT p.id
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = p_uid
  );

  DELETE FROM public.coupons WHERE user_id = p_uid;
  DELETE FROM public.notifications WHERE user_id = p_uid;
  DELETE FROM public.notification_settings WHERE user_id = p_uid;
  DELETE FROM public.store_followers WHERE user_id = p_uid;
  DELETE FROM public.merchant_payments WHERE owner_id = p_uid;
  DELETE FROM public.chats WHERE participant_1_id = p_uid OR participant_2_id = p_uid;

  IF v_email IS NOT NULL THEN
    DELETE FROM public.account_deletion_requests WHERE lower(email) = lower(v_email);
  END IF;

  -- Explicitly remove every product published by this account before removing
  -- the stores. This guarantees the seller's products disappear from the public
  -- homepage and from public.products, while preserving other sellers' products.
  DELETE FROM public.products p
  USING public.stores s
  WHERE p.store_id = s.id
    AND s.owner_id = p_uid;
  GET DIAGNOSTICS v_deleted_products = ROW_COUNT;

  -- Remove the owned stores themselves. Any remaining store-owned dependent
  -- records follow the existing foreign-key CASCADE rules.
  DELETE FROM public.stores WHERE owner_id = p_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'owned_stores', v_owned_stores,
    'deleted_products', v_deleted_products,
    'deleted_buyer_orders', v_deleted_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_data(uuid) TO service_role;
