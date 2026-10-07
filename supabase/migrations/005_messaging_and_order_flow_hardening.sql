-- Kilix messaging/order-flow hardening.
-- Keeps the existing canonical schema; only adds safer chat/order orchestration.

CREATE OR REPLACE FUNCTION public.get_or_create_chat(p_other_user_id uuid, p_related_order_id uuid DEFAULT NULL::uuid)
RETURNS public.chats
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_current uuid := auth.uid();
  v_chat public.chats;
  v_a text;
  v_b text;
BEGIN
  IF v_current IS NULL OR p_other_user_id IS NULL OR p_other_user_id = v_current THEN
    RAISE EXCEPTION 'INVALID_PARTICIPANTS';
  END IF;

  v_a := LEAST(v_current::text, p_other_user_id::text);
  v_b := GREATEST(v_current::text, p_other_user_id::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_a || ':' || v_b, 0));

  SELECT c.* INTO v_chat
  FROM public.chats AS c
  WHERE (c.participant_1_id = v_current AND c.participant_2_id = p_other_user_id)
     OR (c.participant_1_id = p_other_user_id AND c.participant_2_id = v_current)
  ORDER BY c.created_at
  LIMIT 1;

  IF FOUND THEN
    IF p_related_order_id IS NOT NULL AND v_chat.related_order_id IS NULL THEN
      UPDATE public.chats
      SET related_order_id = p_related_order_id, updated_at = now()
      WHERE id = v_chat.id
      RETURNING * INTO v_chat;
    END IF;
    RETURN v_chat;
  END IF;

  INSERT INTO public.chats(participant_1_id, participant_2_id, related_order_id)
  VALUES(v_current, p_other_user_id, p_related_order_id)
  RETURNING * INTO v_chat;

  RETURN v_chat;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_store_chat(p_store_id uuid)
RETURNS public.chats
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT s.owner_id INTO v_owner
  FROM public.stores AS s
  WHERE s.id = p_store_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'STORE_NOT_FOUND';
  END IF;

  IF v_owner = auth.uid() THEN
    RAISE EXCEPTION 'CANNOT_MESSAGE_OWN_STORE';
  END IF;

  RETURN public.get_or_create_chat(v_owner, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_store_chat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_order_notifications()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT s.owner_id INTO v_owner
  FROM public.stores AS s
  WHERE s.id = COALESCE(NEW.store_id, OLD.store_id);

  IF TG_OP = 'INSERT' THEN
    IF v_owner IS NOT NULL THEN
      PERFORM public.create_notification(
        v_owner, 'order_created', 'طلبية جديدة', 'وصلت طلبية جديدة إلى متجرك',
        NEW.id, NEW.product_id, NEW.store_id, NULL
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'shipping' AND NEW.user_id IS NOT NULL THEN
      PERFORM public.create_notification(
        NEW.user_id, 'order_shipping', 'تم تأكيد الطلب',
        'تم تأكيد طلبك من طرف التاجر وأصبح قيد الشحن',
        NEW.id, NEW.product_id, NEW.store_id, NULL
      );
    ELSIF NEW.status = 'out_of_stock' AND NEW.user_id IS NOT NULL THEN
      PERFORM public.create_notification(
        NEW.user_id, 'order_out_of_stock', 'نفد المخزون',
        'نعتذر، المنتج المطلوب غير متوفر حالياً',
        NEW.id, NEW.product_id, NEW.store_id, NULL
      );
    ELSIF NEW.status = 'delivered' AND v_owner IS NOT NULL THEN
      PERFORM public.create_notification(
        v_owner, 'order_delivered', 'تم استلام الطلب',
        'أكد المشتري استلام الطلب', NEW.id, NEW.product_id, NEW.store_id, NULL
      );
    ELSIF NEW.status = 'completed' AND v_owner IS NOT NULL THEN
      PERFORM public.create_notification(
        v_owner, 'order_completed', 'اكتملت الطلبية',
        'تم إكمال الطلب بعد تقييم المشتري', NEW.id, NEW.product_id, NEW.store_id, NULL
      );
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_update_order_status(p_order_id uuid, p_new_status text)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_order public.orders;
  v_owner uuid;
  v_chat public.chats;
  v_message text;
BEGIN
  SELECT o.* INTO v_order
  FROM public.orders AS o
  JOIN public.stores AS s ON s.id = o.store_id
  WHERE o.id = p_order_id
    AND s.owner_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_FORBIDDEN';
  END IF;

  IF p_new_status = 'shipping' THEN
    IF v_order.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    v_message := 'تم تأكيد طلبك من طرف التاجر وأصبح قيد الشحن';
  ELSIF p_new_status = 'out_of_stock' THEN
    IF v_order.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    v_message := 'نعتذر، المنتج المطلوب غير متوفر حالياً ونفد من المخزون';
  ELSIF p_new_status = 'cancelled' THEN
    IF v_order.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    v_message := NULL;
  ELSE
    RAISE EXCEPTION 'INVALID_MERCHANT_STATUS';
  END IF;

  UPDATE public.orders
  SET status = p_new_status,
      shipped_at = CASE WHEN p_new_status = 'shipping' THEN now() ELSE shipped_at END,
      cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN now() ELSE cancelled_at END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  SELECT s.owner_id INTO v_owner
  FROM public.stores AS s
  WHERE s.id = v_order.store_id;

  IF v_message IS NOT NULL
     AND v_order.user_id IS NOT NULL
     AND v_owner IS NOT NULL
     AND v_order.user_id <> v_owner THEN

    SELECT c.* INTO v_chat
    FROM public.chats AS c
    WHERE (c.participant_1_id = v_owner AND c.participant_2_id = v_order.user_id)
       OR (c.participant_1_id = v_order.user_id AND c.participant_2_id = v_owner)
    ORDER BY c.created_at
    LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO public.chats(participant_1_id, participant_2_id, related_order_id)
      VALUES(v_owner, v_order.user_id, v_order.id)
      RETURNING * INTO v_chat;
    ELSIF v_chat.related_order_id IS NULL THEN
      UPDATE public.chats
      SET related_order_id = v_order.id, updated_at = now()
      WHERE id = v_chat.id
      RETURNING * INTO v_chat;
    END IF;

    INSERT INTO public.chat_messages(chat_id, sender_id, content)
    SELECT v_chat.id, v_owner, v_message
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.chat_messages AS cm
      WHERE cm.chat_id = v_chat.id
        AND cm.sender_id = v_owner
        AND cm.content = v_message
        AND cm.created_at >= now() - interval '2 minutes'
    );
  END IF;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_update_order_status(uuid, text) TO authenticated;
