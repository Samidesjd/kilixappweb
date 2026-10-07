-- Final account deletion hardening.
-- Allows a user's auth account to be deleted even when their former store has
-- historical orders/reviews belonging to other users. Those historical rows
-- keep their transactional content but lose references to the deleted store/product.

ALTER TABLE public.orders ALTER COLUMN store_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.order_reviews ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_store_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.order_reviews DROP CONSTRAINT IF EXISTS order_reviews_product_id_fkey;
ALTER TABLE public.order_reviews
  ADD CONSTRAINT order_reviews_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- First remove the user's own buyer-side orders and their dependent data.
  DELETE FROM public.orders
  WHERE user_id = v_uid;

  -- Historical orders/reviews belonging to other users must not be deleted
  -- just because the seller account disappears. Remove references to the
  -- deleted seller's stores/products so the seller data can be fully removed.
  UPDATE public.orders o
  SET store_id = NULL,
      product_id = NULL
  WHERE o.store_id IN (
    SELECT s.id FROM public.stores s WHERE s.owner_id = v_uid
  );

  UPDATE public.order_reviews r
  SET product_id = NULL
  WHERE r.product_id IN (
    SELECT p.id
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = v_uid
  );

  -- Remove uploaded personal/media objects owned by this account.
  DELETE FROM storage.objects
  WHERE owner = v_uid::text
    AND bucket_id IN ('avatars', 'media');

  -- auth.users has ON DELETE CASCADE relationships to the account-owned
  -- Kilix data (profile, store, followers, chats, notifications, payments,
  -- coupons, etc.). The two updates above remove the only historical RESTRICT
  -- blockers before deleting the auth identity.
  DELETE FROM auth.users WHERE id = v_uid;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_created ON public.account_deletion_requests(created_at DESC);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_account_deletion_request(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_email = '' OR position('@' IN v_email) < 2 THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  IF char_length(v_email) > 320 THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  INSERT INTO public.account_deletion_requests(email) VALUES (v_email);
  RETURN jsonb_build_object('success', TRUE);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_account_deletion_request(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_account_deletion_request(text) TO anon, authenticated;
