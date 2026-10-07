-- Runtime account deletion: database-owned data cleanup callable only by the
-- trusted server function, followed by Supabase Auth admin deletion.

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

  -- Remove the user's own buyer-side transactional records first. Their
  -- reviews/coupons and related notifications follow from these relationships.
  DELETE FROM public.orders WHERE user_id = p_uid;
  GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;

  -- Do not delete other buyers' historical orders/reviews merely because the
  -- seller account is being removed. Remove only the references to the
  -- deleted seller's store/products so those seller records can be cascaded.
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

  -- Explicitly clear user-owned rows before the final auth deletion. This is
  -- redundant with several ON DELETE CASCADE rules, but makes the contract
  -- deterministic and protects the account-deletion path from schema drift.
  DELETE FROM public.coupons WHERE user_id = p_uid;
  DELETE FROM public.notifications WHERE user_id = p_uid;
  DELETE FROM public.notification_settings WHERE user_id = p_uid;
  DELETE FROM public.store_followers WHERE user_id = p_uid;
  DELETE FROM public.merchant_payments WHERE owner_id = p_uid;
  DELETE FROM public.chats WHERE participant_1_id = p_uid OR participant_2_id = p_uid;

  -- Any external deletion request for this email is no longer needed after a
  -- successful account deletion and must not become retained personal data.
  IF v_email IS NOT NULL THEN
    DELETE FROM public.account_deletion_requests WHERE lower(email) = lower(v_email);
  END IF;

  -- Explicitly delete stores owned by this account. Products, store followers,
  -- merchant payments and product-image embeddings tied to these stores are
  -- removed by their existing foreign-key CASCADE rules. Buyer order history
  -- was detached above so deleting the seller cannot delete another user's order.
  DELETE FROM public.stores WHERE owner_id = p_uid;

  -- Profile rows, if present, are deleted by the subsequent auth.users deletion
  -- through the canonical relationship.
  RETURN jsonb_build_object(
    'success', TRUE,
    'owned_stores', v_owned_stores,
    'deleted_buyer_orders', v_deleted_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_data(uuid) TO service_role;

-- Keep the authenticated RPC only as a guarded entry point if an older client
-- still calls it. Storage cleanup is intentionally handled by the trusted
-- server Edge Function because storage.objects cannot be deleted directly via
-- SQL in Supabase.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  RETURN public.delete_account_data(auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
