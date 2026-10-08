-- Allow checkout without an account.
-- Guest orders keep user_id NULL; registered orders keep the authenticated user id.
ALTER TABLE public.orders
  ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_order(
  p_store_id UUID,
  p_product_id UUID,
  p_customer_name TEXT,
  p_phone TEXT,
  p_delivery_type TEXT,
  p_wilaya TEXT,
  p_commune TEXT,
  p_street_address TEXT,
  p_notes TEXT,
  p_quantity INTEGER,
  p_details JSONB DEFAULT '[]'::JSONB
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_order public.orders;
  v_user UUID := auth.uid();
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  IF p_delivery_type NOT IN ('home','office') THEN RAISE EXCEPTION 'INVALID_DELIVERY_TYPE'; END IF;
  IF NULLIF(trim(COALESCE(p_customer_name,'')),'') IS NULL THEN RAISE EXCEPTION 'CUSTOMER_NAME_REQUIRED'; END IF;
  IF NULLIF(trim(COALESCE(p_phone,'')),'') IS NULL THEN RAISE EXCEPTION 'PHONE_REQUIRED'; END IF;
  IF NULLIF(trim(COALESCE(p_wilaya,'')),'') IS NULL OR NULLIF(trim(COALESCE(p_commune,'')),'') IS NULL THEN RAISE EXCEPTION 'DELIVERY_LOCATION_REQUIRED'; END IF;
  IF p_delivery_type='home' AND NULLIF(trim(COALESCE(p_street_address,'')),'') IS NULL THEN RAISE EXCEPTION 'STREET_ADDRESS_REQUIRED'; END IF;

  SELECT p.* INTO v_product
  FROM public.products p
  WHERE p.id = p_product_id AND p.store_id = p_store_id AND p.is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE'; END IF;

  INSERT INTO public.orders(
    store_id,user_id,product_id,customer_name,phone,email,delivery_type,wilaya,commune,street_address,notes,
    product_title,quantity,quantity_unit,unit_price,total_price,currency,image_url,category,details,status
  ) VALUES (
    p_store_id,v_user,p_product_id,trim(p_customer_name),trim(p_phone),
    CASE WHEN v_user IS NULL THEN NULL ELSE (SELECT email FROM public.users WHERE auth_id = v_user) END,
    p_delivery_type,trim(p_wilaya),trim(p_commune),NULLIF(trim(p_street_address),''),COALESCE(trim(p_notes),''),
    v_product.title,p_quantity,'قطعة',v_product.price,v_product.price*p_quantity,'دج',
    CASE WHEN cardinality(v_product.images) > 0 THEN v_product.images[1] ELSE NULL END,
    v_product.category,COALESCE(p_details,'[]'::jsonb),'pending'
  ) RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB
) TO anon, authenticated;
