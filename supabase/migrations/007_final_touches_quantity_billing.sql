-- Kilix final touches: order quantity limits + billing rate 0.3% + safer account login contract.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS min_order_quantity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_order_quantity INTEGER NOT NULL DEFAULT 1000000;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_min_order_quantity_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_min_order_quantity_check CHECK (min_order_quantity >= 1);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_max_order_quantity_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_max_order_quantity_check CHECK (max_order_quantity >= min_order_quantity);

UPDATE public.products
SET min_order_quantity = GREATEST(COALESCE(min_order_quantity,1),1),
    max_order_quantity = GREATEST(COALESCE(max_order_quantity,1000000), GREATEST(COALESCE(min_order_quantity,1),1));

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
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
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

  IF p_quantity < v_product.min_order_quantity THEN
    RAISE EXCEPTION 'ORDER_QUANTITY_BELOW_MIN:%', v_product.min_order_quantity;
  END IF;
  IF p_quantity > v_product.max_order_quantity THEN
    RAISE EXCEPTION 'ORDER_QUANTITY_ABOVE_MAX:%', v_product.max_order_quantity;
  END IF;

  INSERT INTO public.orders(
    store_id,user_id,product_id,customer_name,phone,email,delivery_type,wilaya,commune,street_address,notes,
    product_title,quantity,quantity_unit,unit_price,total_price,currency,image_url,category,details,status
  ) VALUES (
    p_store_id,v_user,p_product_id,trim(p_customer_name),trim(p_phone),
    (SELECT email FROM public.users WHERE auth_id = v_user),
    p_delivery_type,trim(p_wilaya),trim(p_commune),NULLIF(trim(p_street_address),''),COALESCE(trim(p_notes),''),
    v_product.title,p_quantity,'قطعة',v_product.price,v_product.price*p_quantity,'دج',
    CASE WHEN cardinality(v_product.images) > 0 THEN v_product.images[1] ELSE NULL END,
    v_product.category,COALESCE(p_details,'[]'::jsonb),'pending'
  ) RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_billing_summary(p_store_id uuid)
RETURNS TABLE(store_id uuid, gross_order_value numeric, fee_rate numeric, accumulated_fee numeric, paid_fee numeric, outstanding_fee numeric, payment_threshold numeric, is_payment_due boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross numeric := 0;
  v_paid numeric := 0;
  v_accumulated numeric := 0;
  v_outstanding numeric := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores AS s WHERE s.id = p_store_id AND s.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'STORE_NOT_FOUND_OR_FORBIDDEN';
  END IF;
  SELECT COALESCE(SUM(o.total_price),0) INTO v_gross
  FROM public.orders AS o
  WHERE o.store_id = p_store_id AND o.status NOT IN ('cancelled','out_of_stock');
  SELECT COALESCE(SUM(mp.amount),0) INTO v_paid
  FROM public.merchant_payments AS mp
  WHERE mp.store_id = p_store_id AND mp.status='paid';
  v_accumulated := ROUND(v_gross * 0.003, 2);
  v_outstanding := GREATEST(v_accumulated-v_paid,0);
  RETURN QUERY SELECT p_store_id, v_gross, 0.003::numeric, v_accumulated, v_paid, v_outstanding, 500::numeric, (v_outstanding >= 500);
END;
$$;

-- Keep payment-due notifications consistent with the same 0.3% rule.
CREATE OR REPLACE FUNCTION public.trg_order_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_owner UUID; v_chat public.chats; v_text TEXT;
BEGIN
  SELECT owner_id INTO v_owner FROM public.stores WHERE id=COALESCE(NEW.store_id,OLD.store_id);
  IF TG_OP='INSERT' THEN
    IF v_owner IS NOT NULL THEN
      PERFORM public.create_notification(v_owner,'order_created','طلبية جديدة','وصلت طلبية جديدة إلى متجرك',NEW.id,NEW.product_id,NEW.store_id,NULL);
      IF GREATEST(
        ROUND(COALESCE((SELECT SUM(o.total_price) FROM public.orders o WHERE o.store_id=NEW.store_id AND o.status NOT IN ('cancelled','out_of_stock')),0) * 0.003, 2)
        - COALESCE((SELECT SUM(mp.amount) FROM public.merchant_payments mp WHERE mp.store_id=NEW.store_id AND mp.status='paid'),0), 0) >= 500
        AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=v_owner AND n.type='payment_due' AND n.store_id=NEW.store_id AND n.read=FALSE) THEN
        PERFORM public.create_notification(v_owner,'payment_due','الدفع المستحق','وصلت رسوم الاشتراك إلى 500 دج أو أكثر؛ يرجى تسوية الرصيد المستحق.',NULL,NULL,NEW.store_id,NULL);
      END IF;
    END IF;
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status='shipping' THEN
      PERFORM public.create_notification(NEW.user_id,'order_shipping','تم تأكيد الطلب','تم تأكيد طلبك من طرف التاجر وأصبح قيد الشحن',NEW.id,NEW.product_id,NEW.store_id,NULL);
      IF NEW.user_id IS NOT NULL AND v_owner IS NOT NULL AND NEW.user_id <> v_owner THEN
        SELECT c.* INTO v_chat FROM public.chats c
        WHERE (c.participant_1_id=v_owner AND c.participant_2_id=NEW.user_id)
           OR (c.participant_1_id=NEW.user_id AND c.participant_2_id=v_owner)
        ORDER BY c.created_at LIMIT 1;
        IF NOT FOUND THEN
          INSERT INTO public.chats(participant_1_id,participant_2_id,related_order_id)
          VALUES(v_owner,NEW.user_id,NEW.id) RETURNING * INTO v_chat;
        ELSIF v_chat.related_order_id IS NULL THEN
          UPDATE public.chats SET related_order_id=NEW.id,updated_at=NOW() WHERE id=v_chat.id RETURNING * INTO v_chat;
        END IF;
        v_text := 'تم تأكيد طلبك من طرف التاجر وأصبح قيد الشحن';
        INSERT INTO public.chat_messages(chat_id,sender_id,content)
        SELECT v_chat.id,v_owner,v_text
        WHERE NOT EXISTS (SELECT 1 FROM public.chat_messages cm WHERE cm.chat_id=v_chat.id AND cm.sender_id=v_owner AND cm.content=v_text AND cm.created_at>=NOW()-interval '2 minutes');
      END IF;
    ELSIF NEW.status='out_of_stock' THEN
      PERFORM public.create_notification(NEW.user_id,'order_out_of_stock','نفد المخزون','نعتذر، المنتج المطلوب غير متوفر حالياً',NEW.id,NEW.product_id,NEW.store_id,NULL);
      IF NEW.user_id IS NOT NULL AND v_owner IS NOT NULL AND NEW.user_id <> v_owner THEN
        SELECT c.* INTO v_chat FROM public.chats c
        WHERE (c.participant_1_id=v_owner AND c.participant_2_id=NEW.user_id)
           OR (c.participant_1_id=NEW.user_id AND c.participant_2_id=v_owner)
        ORDER BY c.created_at LIMIT 1;
        IF NOT FOUND THEN
          INSERT INTO public.chats(participant_1_id,participant_2_id,related_order_id)
          VALUES(v_owner,NEW.user_id,NEW.id) RETURNING * INTO v_chat;
        ELSIF v_chat.related_order_id IS NULL THEN
          UPDATE public.chats SET related_order_id=NEW.id,updated_at=NOW() WHERE id=v_chat.id RETURNING * INTO v_chat;
        END IF;
        v_text := 'نعتذر، المنتج المطلوب غير متوفر حالياً ونفد من المخزون';
        INSERT INTO public.chat_messages(chat_id,sender_id,content)
        SELECT v_chat.id,v_owner,v_text
        WHERE NOT EXISTS (SELECT 1 FROM public.chat_messages cm WHERE cm.chat_id=v_chat.id AND cm.sender_id=v_owner AND cm.content=v_text AND cm.created_at>=NOW()-interval '2 minutes');
      END IF;
    ELSIF NEW.status='delivered' THEN
      PERFORM public.create_notification(v_owner,'order_delivered','تم استلام الطلب','أكد المشتري استلام الطلب',NEW.id,NEW.product_id,NEW.store_id,NULL);
    ELSIF NEW.status='completed' AND OLD.status='delivered' THEN
      PERFORM public.create_notification(v_owner,'order_completed','اكتملت الطلبية','تم إكمال الطلب بعد تقييم المشتري',NEW.id,NEW.product_id,NEW.store_id,NULL);
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
