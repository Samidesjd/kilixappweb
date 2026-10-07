-- Kilix: merchant product removal is an archive (preserves historical orders),
-- and order creation locks/checks the product so an archived product cannot receive a new order.
CREATE OR REPLACE FUNCTION public.merchant_archive_product(p_product_id uuid)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_product public.products;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  UPDATE public.products p
  SET is_active = FALSE, updated_at = now()
  WHERE p.id = p_product_id
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.owner_id = auth.uid())
  RETURNING p.* INTO v_product;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND_OR_NOT_OWNER'; END IF;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.merchant_archive_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_archive_product(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_order(
  p_store_id uuid, p_product_id uuid, p_customer_name text, p_phone text,
  p_delivery_type text, p_wilaya text, p_commune text, p_street_address text,
  p_notes text, p_quantity integer, p_details jsonb DEFAULT '[]'::jsonb
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_product public.products; v_order public.orders; v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_quantity IS NULL OR p_quantity<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  IF p_delivery_type NOT IN ('home','office') THEN RAISE EXCEPTION 'INVALID_DELIVERY_TYPE'; END IF;
  IF NULLIF(trim(COALESCE(p_customer_name,'')),'') IS NULL THEN RAISE EXCEPTION 'CUSTOMER_NAME_REQUIRED'; END IF;
  IF NULLIF(trim(COALESCE(p_phone,'')),'') IS NULL THEN RAISE EXCEPTION 'PHONE_REQUIRED'; END IF;
  IF NULLIF(trim(COALESCE(p_wilaya,'')),'') IS NULL OR NULLIF(trim(COALESCE(p_commune,'')),'') IS NULL THEN RAISE EXCEPTION 'DELIVERY_LOCATION_REQUIRED'; END IF;
  IF p_delivery_type='home' AND NULLIF(trim(COALESCE(p_street_address,'')),'') IS NULL THEN RAISE EXCEPTION 'STREET_ADDRESS_REQUIRED'; END IF;
  SELECT p.* INTO v_product FROM public.products p
  WHERE p.id=p_product_id AND p.store_id=p_store_id AND p.is_active=TRUE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE'; END IF;
  IF p_quantity<v_product.min_order_quantity THEN RAISE EXCEPTION 'ORDER_QUANTITY_BELOW_MIN:%',v_product.min_order_quantity; END IF;
  IF p_quantity>v_product.max_order_quantity THEN RAISE EXCEPTION 'ORDER_QUANTITY_ABOVE_MAX:%',v_product.max_order_quantity; END IF;
  INSERT INTO public.orders(store_id,user_id,product_id,customer_name,phone,email,delivery_type,wilaya,commune,street_address,notes,product_title,quantity,quantity_unit,unit_price,total_price,currency,image_url,category,details,status)
  VALUES(p_store_id,v_user,p_product_id,trim(p_customer_name),trim(p_phone),(SELECT email FROM public.users WHERE auth_id=v_user),p_delivery_type,trim(p_wilaya),trim(p_commune),NULLIF(trim(p_street_address),''),COALESCE(trim(p_notes),''),v_product.title,p_quantity,'قطعة',v_product.price,v_product.price*p_quantity,'دج',CASE WHEN cardinality(v_product.images)>0 THEN v_product.images[1] ELSE NULL END,v_product.category,COALESCE(p_details,'[]'::jsonb),'pending')
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;
