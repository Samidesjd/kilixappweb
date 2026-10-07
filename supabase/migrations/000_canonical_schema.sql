-- Kilix canonical database schema
-- Fresh database contract for the mobile application.
-- All application-owned user/order/chat/review/billing identities use auth.users.id.
-- users.auth_id is the single profile identity; user_code is the public Kilix code.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_public_code(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
BEGIN
  v_code := UPPER(p_prefix) || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10));
  RETURN v_code;
END;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_code TEXT NOT NULL UNIQUE,
  email TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  country TEXT DEFAULT 'DZ',
  wilaya TEXT,
  commune TEXT,
  address TEXT,
  account_type TEXT NOT NULL DEFAULT 'buyer' CHECK (account_type IN ('buyer','merchant','both')),
  avatar_url TEXT,
  has_store BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_user_code ON public.users(user_code);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  LOOP
    v_code := public.generate_public_code('KX');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE user_code = v_code);
  END LOOP;

  INSERT INTO public.users (
    auth_id, user_code, email, first_name, last_name, phone,
    country, wilaya, commune, address, account_type
  ) VALUES (
    NEW.id,
    v_code,
    NEW.email,
    COALESCE(v_meta->>'first_name', ''),
    COALESCE(v_meta->>'last_name', ''),
    NULLIF(v_meta->>'phone', ''),
    COALESCE(NULLIF(v_meta->>'country', ''), 'DZ'),
    NULLIF(v_meta->>'wilaya', ''),
    NULLIF(v_meta->>'commune', ''),
    NULLIF(v_meta->>'address', ''),
    COALESCE(NULLIF(v_meta->>'account_type', ''), 'buyer')
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.users.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.users.last_name),
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Notification preferences are part of the canonical application contract.
CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  order_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  inventory_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  message_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  rating_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  payment_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  system_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.ensure_notification_settings()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_settings(user_id) VALUES(NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_ensure_notification_settings ON auth.users;
CREATE TRIGGER trigger_ensure_notification_settings
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.ensure_notification_settings();

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT auth_id, user_code, first_name, last_name, avatar_url
FROM public.users;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  store_code TEXT NOT NULL DEFAULT public.generate_public_code('KS') UNIQUE,
  store_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  products_type TEXT NOT NULL DEFAULT '',
  merchant_type TEXT NOT NULL DEFAULT 'wholesaler' CHECK (merchant_type IN ('wholesaler','factory')),
  logo_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  followers_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON public.stores(owner_id);

CREATE OR REPLACE FUNCTION public.sync_user_store_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.users SET has_store = TRUE, account_type = CASE WHEN account_type = 'buyer' THEN 'both' ELSE account_type END, updated_at = NOW()
    WHERE auth_id = NEW.owner_id;
    RETURN NEW;
  END IF;
  UPDATE public.users SET has_store = FALSE, account_type = CASE WHEN account_type = 'both' THEN 'buyer' ELSE account_type END, updated_at = NOW()
  WHERE auth_id = OLD.owner_id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trigger_sync_user_store_flag ON public.stores;
CREATE TRIGGER trigger_sync_user_store_flag
AFTER INSERT OR UPDATE OR DELETE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.sync_user_store_flag();

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('electronics','clothing','home','construction')),
  template TEXT NOT NULL DEFAULT 'clothing' CHECK (template IN ('clothing','computer','phone','watch','home')),
  sizes TEXT[] NOT NULL DEFAULT '{}',
  colors TEXT[] NOT NULL DEFAULT '{}',
  ram TEXT[] NOT NULL DEFAULT '{}',
  storage TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  videos TEXT[] NOT NULL DEFAULT '{}',
  min_order_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_order_quantity >= 1),
  max_order_quantity INTEGER NOT NULL DEFAULT 1000000 CHECK (max_order_quantity >= min_order_quantity),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
DO $$ BEGIN
  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_title_length;
  ALTER TABLE public.products ADD CONSTRAINT products_title_length CHECK (char_length(title) BETWEEN 1 AND 150);
  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_description_length;
  ALTER TABLE public.products ADD CONSTRAINT products_description_length CHECK (char_length(description) <= 1000);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS embedding vector(768);
CREATE INDEX IF NOT EXISTS products_embedding_idx
  ON public.products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('home','office')),
  wilaya TEXT NOT NULL,
  commune TEXT NOT NULL,
  street_address TEXT,
  notes TEXT NOT NULL DEFAULT '',
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  quantity_unit TEXT NOT NULL DEFAULT 'قطعة',
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  currency TEXT NOT NULL DEFAULT 'دج',
  image_url TEXT,
  category TEXT,
  details JSONB NOT NULL DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','shipping','delivered','completed','out_of_stock','cancelled')),
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_created ON public.orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product_status ON public.orders(product_id, status);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_reviews_product_created ON public.order_reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_reviews_user ON public.order_reviews(user_id);

CREATE TABLE IF NOT EXISTS public.product_rating_summary (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  rating_distribution JSONB NOT NULL DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.refresh_product_rating(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC(3,2);
  v_count INTEGER;
  v_distribution JSONB;
BEGIN
  SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0), COUNT(*)::INTEGER
    INTO v_avg, v_count
  FROM public.order_reviews
  WHERE product_id = p_product_id;

  SELECT COALESCE(jsonb_object_agg(bucket.rating::TEXT, bucket.cnt ORDER BY bucket.rating), '{"1":0,"2":0,"3":0,"4":0,"5":0}'::jsonb)
    INTO v_distribution
  FROM (
    SELECT gs.rating, COUNT(r.id)::INTEGER AS cnt
    FROM generate_series(1,5) gs(rating)
    LEFT JOIN public.order_reviews r ON r.product_id = p_product_id AND r.rating = gs.rating
    GROUP BY gs.rating
  ) bucket;

  INSERT INTO public.product_rating_summary(product_id, average_rating, total_reviews, rating_distribution, updated_at)
  VALUES(p_product_id, v_avg, v_count, v_distribution, NOW())
  ON CONFLICT (product_id) DO UPDATE SET
    average_rating = EXCLUDED.average_rating,
    total_reviews = EXCLUDED.total_reviews,
    rating_distribution = EXCLUDED.rating_distribution,
    updated_at = NOW();

  UPDATE public.products
  SET average_rating = v_avg, total_reviews = v_count, updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_store_rating(p_target_store_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.stores s
  SET average_rating = COALESCE((
    SELECT ROUND(AVG(r.rating)::numeric, 2)
    FROM public.order_reviews r
    JOIN public.products p ON p.id = r.product_id
    WHERE p.store_id = p_target_store_id
  ), 0),
      updated_at = NOW()
  WHERE s.id = p_target_store_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_product_rating(CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END);
  PERFORM public.refresh_store_rating((SELECT store_id FROM public.products WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_refresh_product_rating ON public.order_reviews;
CREATE TRIGGER trigger_refresh_product_rating
AFTER INSERT OR UPDATE OR DELETE ON public.order_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_product_rating();

-- ---------------------------------------------------------------------------
-- Followers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_store_followers_store ON public.store_followers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_followers_user ON public.store_followers(user_id);

CREATE OR REPLACE FUNCTION public.refresh_store_followers_count(p_store_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.stores
  SET followers_count = (SELECT COUNT(*) FROM public.store_followers WHERE store_id = p_store_id), updated_at = NOW()
  WHERE id = p_store_id;
$$;
CREATE OR REPLACE FUNCTION public.trg_refresh_store_followers_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refresh_store_followers_count(CASE WHEN TG_OP = 'DELETE' THEN OLD.store_id ELSE NEW.store_id END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_refresh_store_followers_count ON public.store_followers;
CREATE TRIGGER trigger_refresh_store_followers_count
AFTER INSERT OR DELETE ON public.store_followers
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_store_followers_count();

-- ---------------------------------------------------------------------------
-- Chats + messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (participant_1_id <> participant_2_id)
);
CREATE INDEX IF NOT EXISTS idx_chats_participants ON public.chats(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_chats_participant_2 ON public.chats(participant_2_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created ON public.chat_messages(chat_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read);

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_order_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_store_id UUID DEFAULT NULL,
  p_chat_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_enabled BOOLEAN := TRUE;
  v_allowed BOOLEAN := TRUE;
  v_quiet_enabled BOOLEAN := FALSE;
  v_quiet_start TIME;
  v_quiet_end TIME;
  v_now TIME := LOCALTIME;
  v_in_quiet BOOLEAN := FALSE;
BEGIN
  SELECT enabled,
    CASE
      WHEN p_type LIKE 'order_%' THEN order_notifications
      WHEN p_type LIKE 'inventory_%' OR p_type = 'inventory' THEN inventory_notifications
      WHEN p_type = 'message' THEN message_notifications
      WHEN p_type = 'review' THEN rating_notifications
      WHEN p_type = 'follow' THEN system_notifications
      WHEN p_type LIKE 'payment_%' OR p_type = 'payment' THEN payment_notifications
      ELSE system_notifications
    END,
    quiet_hours_enabled, quiet_hours_start, quiet_hours_end
  INTO v_enabled, v_allowed, v_quiet_enabled, v_quiet_start, v_quiet_end
  FROM public.notification_settings
  WHERE user_id = p_user_id;

  IF NOT COALESCE(v_enabled, TRUE) OR NOT COALESCE(v_allowed, TRUE) THEN RETURN NULL; END IF;

  IF COALESCE(v_quiet_enabled, FALSE) AND v_quiet_start IS NOT NULL AND v_quiet_end IS NOT NULL THEN
    IF v_quiet_start < v_quiet_end THEN
      v_in_quiet := v_now >= v_quiet_start AND v_now < v_quiet_end;
    ELSE
      v_in_quiet := v_now >= v_quiet_start OR v_now < v_quiet_end;
    END IF;
  END IF;

  -- Keep the notification in the database even during quiet hours; the client can suppress presentation.
  INSERT INTO public.notifications(user_id,type,title,body,order_id,product_id,store_id,chat_id)
  VALUES(p_user_id,p_type,p_title,p_body,p_order_id,p_product_id,p_store_id,p_chat_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Billing / payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_code TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed','cancelled')),
  transaction_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_merchant_payments_store_created ON public.merchant_payments(store_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_store_billing_summary(p_store_id UUID)
RETURNS TABLE(
  store_id UUID,
  gross_order_value NUMERIC,
  fee_rate NUMERIC,
  accumulated_fee NUMERIC,
  paid_fee NUMERIC,
  outstanding_fee NUMERIC,
  payment_threshold NUMERIC,
  payment_required BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross NUMERIC := 0;
  v_accum NUMERIC := 0;
  v_paid NUMERIC := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id=p_store_id AND owner_id=auth.uid()) THEN
    RAISE EXCEPTION 'STORE_NOT_FOUND_OR_FORBIDDEN';
  END IF;
  SELECT COALESCE(SUM(o.total_price),0) INTO v_gross
  FROM public.orders o
  WHERE o.store_id=p_store_id AND o.status NOT IN ('cancelled','out_of_stock');
  v_accum := ROUND(v_gross * 0.003, 2);
  SELECT COALESCE(SUM(mp.amount),0) INTO v_paid
  FROM public.merchant_payments mp
  WHERE mp.store_id=p_store_id AND mp.status='paid';

  RETURN QUERY SELECT p_store_id, v_gross, 0.003::numeric, v_accum, v_paid, GREATEST(v_accum-v_paid,0), 500::numeric, GREATEST(v_accum-v_paid,0) >= 500;
END;
$$;


-- ---------------------------------------------------------------------------
-- RPC: create order securely from DB price
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RPC: merchant order status transition
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merchant_update_order_status(p_order_id UUID, p_new_status TEXT)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_owner UUID := auth.uid();
BEGIN
  SELECT o.* INTO v_order
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = p_order_id AND s.owner_id = v_owner
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_FORBIDDEN'; END IF;

  IF p_new_status NOT IN ('shipping','out_of_stock','cancelled') THEN RAISE EXCEPTION 'INVALID_MERCHANT_STATUS'; END IF;
  IF p_new_status = 'shipping' AND v_order.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
  IF p_new_status = 'out_of_stock' AND v_order.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;

  UPDATE public.orders
  SET status = p_new_status,
      shipped_at = CASE WHEN p_new_status='shipping' THEN NOW() ELSE shipped_at END,
      cancelled_at = CASE WHEN p_new_status='cancelled' THEN NOW() ELSE cancelled_at END,
      updated_at = NOW()
  WHERE id = p_order_id
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- Buyer confirms receipt: shipping -> delivered.
CREATE OR REPLACE FUNCTION public.confirm_order_received(p_order_id UUID)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_FORBIDDEN'; END IF;
  IF v_order.status <> 'shipping' THEN RAISE EXCEPTION 'ORDER_NOT_READY_FOR_RECEIPT'; END IF;

  UPDATE public.orders SET status='delivered', updated_at=NOW() WHERE id=p_order_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- Review creates completion atomically and only for delivered orders.
CREATE OR REPLACE FUNCTION public.create_order_review(
  p_order_id UUID,
  p_rating INTEGER,
  p_comment TEXT,
  p_images JSONB DEFAULT '[]'::JSONB
)
RETURNS public.order_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_review public.order_reviews;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_FORBIDDEN'; END IF;
  IF v_order.status <> 'delivered' THEN RAISE EXCEPTION 'ORDER_NOT_DELIVERED'; END IF;

  INSERT INTO public.order_reviews(order_id,product_id,user_id,rating,comment,images,is_verified_purchase)
  VALUES(p_order_id,v_order.product_id,auth.uid(),p_rating,COALESCE(trim(p_comment),''),COALESCE(p_images,'[]'::jsonb),TRUE)
  RETURNING * INTO v_review;

  UPDATE public.orders
  SET status='completed', reviewed=TRUE, reviewed_at=NOW(), completed_at=NOW(), updated_at=NOW()
  WHERE id=p_order_id;
  RETURN v_review;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: chat, follows, billing, public product matching
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_chat(p_other_user_id UUID, p_related_order_id UUID DEFAULT NULL)
RETURNS public.chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_chat public.chats;
BEGIN
  IF auth.uid() IS NULL OR p_other_user_id IS NULL OR p_other_user_id = auth.uid() THEN RAISE EXCEPTION 'INVALID_PARTICIPANTS'; END IF;
  SELECT * INTO v_chat FROM public.chats
  WHERE (participant_1_id=auth.uid() AND participant_2_id=p_other_user_id)
     OR (participant_1_id=p_other_user_id AND participant_2_id=auth.uid())
  ORDER BY created_at ASC LIMIT 1;
  IF FOUND THEN RETURN v_chat; END IF;
  INSERT INTO public.chats(participant_1_id,participant_2_id,related_order_id)
  VALUES(auth.uid(),p_other_user_id,p_related_order_id)
  RETURNING * INTO v_chat;
  RETURN v_chat;
END;
$$;

CREATE OR REPLACE FUNCTION public.follow_store(p_store_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.store_followers(store_id,user_id) VALUES(p_store_id,auth.uid()) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unfollow_store(p_store_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.store_followers WHERE store_id=p_store_id AND user_id=auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.record_merchant_payment(
  p_store_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'manual',
  p_transaction_reference TEXT DEFAULT NULL
)
RETURNS public.merchant_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.merchant_payments;
  v_outstanding NUMERIC := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id=p_store_id AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'STORE_NOT_FOUND_OR_FORBIDDEN'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT'; END IF;
  SELECT outstanding_fee INTO v_outstanding FROM public.get_store_billing_summary(p_store_id);
  IF v_outstanding < 500 THEN RAISE EXCEPTION 'PAYMENT_NOT_DUE'; END IF;
  IF p_amount > v_outstanding THEN RAISE EXCEPTION 'PAYMENT_EXCEEDS_OUTSTANDING'; END IF;
  INSERT INTO public.merchant_payments(store_id,owner_id,invoice_code,amount,method,status,transaction_reference)
  VALUES(p_store_id,auth.uid(),public.generate_public_code('INV'),p_amount,COALESCE(p_method,'manual'),'paid',p_transaction_reference)
  RETURNING * INTO v_payment;
  PERFORM public.create_notification(auth.uid(),'payment','تم تسجيل الدفعة','تم تسجيل دفعة بقيمة ' || p_amount::text || ' دج بنجاح',NULL,NULL,p_store_id,NULL);
  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_products_by_embedding(
  query_embedding vector(768),
  match_count int DEFAULT 12,
  max_distance float DEFAULT 0.35
)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
AS $$
  SELECT p.* FROM public.products p
  WHERE p.is_active = TRUE AND p.embedding IS NOT NULL
    AND (p.embedding <=> query_embedding) <= max_distance
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Keep chat sorting state synchronized with actual messages.
CREATE OR REPLACE FUNCTION public.trg_chat_message_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.chats SET last_message_at=NEW.created_at, updated_at=NEW.created_at WHERE id=NEW.chat_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_chat_message_timestamp ON public.chat_messages;
CREATE TRIGGER trigger_chat_message_timestamp AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.trg_chat_message_timestamp();

-- ---------------------------------------------------------------------------
-- Automatic notifications + timestamps
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_stores_updated_at ON public.stores;
CREATE TRIGGER trg_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.order_reviews;
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.order_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_chats_updated_at ON public.chats;
CREATE TRIGGER trg_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER trg_notification_settings_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
DROP TRIGGER IF EXISTS trigger_order_notifications ON public.orders;
CREATE TRIGGER trigger_order_notifications
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_order_notifications();

CREATE OR REPLACE FUNCTION public.trg_message_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_receiver UUID;
BEGIN
  SELECT CASE WHEN c.participant_1_id = NEW.sender_id THEN c.participant_2_id ELSE c.participant_1_id END
    INTO v_receiver FROM public.chats c WHERE c.id=NEW.chat_id;
  PERFORM public.create_notification(v_receiver,'message','رسالة جديدة','لديك رسالة جديدة في المحادثات',NULL,NULL,NULL,NEW.chat_id);
  UPDATE public.chats SET last_message_at=NEW.created_at, updated_at=NOW() WHERE id=NEW.chat_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_message_notification ON public.chat_messages;
CREATE TRIGGER trigger_message_notification
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_message_notification();

CREATE OR REPLACE FUNCTION public.trg_review_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_store_id UUID; v_owner UUID;
BEGIN
  SELECT p.store_id, s.owner_id INTO v_store_id, v_owner
  FROM public.products p JOIN public.stores s ON s.id=p.store_id
  WHERE p.id=NEW.product_id;
  PERFORM public.create_notification(v_owner,'review','تقييم جديد','تمت إضافة تقييم جديد لمنتجك',NEW.order_id,NEW.product_id,v_store_id,NULL);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_review_notification ON public.order_reviews;
CREATE TRIGGER trigger_review_notification
AFTER INSERT ON public.order_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_review_notification();

CREATE OR REPLACE FUNCTION public.trg_follow_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM public.stores WHERE id=NEW.store_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
    PERFORM public.create_notification(v_owner,'follow','متابع جديد','قام مستخدم بمتابعة متجرك',NULL,NULL,NEW.store_id,NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_follow_notification ON public.store_followers;
CREATE TRIGGER trigger_follow_notification
AFTER INSERT ON public.store_followers
FOR EACH ROW EXECUTE FUNCTION public.trg_follow_notification();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_select ON public.users;
DROP POLICY IF EXISTS users_own_insert ON public.users;
DROP POLICY IF EXISTS users_own_update ON public.users;
DROP POLICY IF EXISTS users_own_delete ON public.users;
CREATE POLICY users_own_select ON public.users FOR SELECT USING (auth.uid()=auth_id);
CREATE POLICY users_own_insert ON public.users FOR INSERT WITH CHECK (auth.uid()=auth_id);
CREATE POLICY users_own_update ON public.users FOR UPDATE USING (auth.uid()=auth_id) WITH CHECK (auth.uid()=auth_id);
CREATE POLICY users_own_delete ON public.users FOR DELETE USING (auth.uid()=auth_id);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stores_public_select ON public.stores;
DROP POLICY IF EXISTS stores_owner_insert ON public.stores;
DROP POLICY IF EXISTS stores_owner_update ON public.stores;
DROP POLICY IF EXISTS stores_owner_delete ON public.stores;
CREATE POLICY stores_public_select ON public.stores FOR SELECT USING (TRUE);
CREATE POLICY stores_owner_insert ON public.stores FOR INSERT WITH CHECK (auth.uid()=owner_id);
CREATE POLICY stores_owner_update ON public.stores FOR UPDATE USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE POLICY stores_owner_delete ON public.stores FOR DELETE USING (auth.uid()=owner_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_public_select ON public.products;
DROP POLICY IF EXISTS products_owner_insert ON public.products;
DROP POLICY IF EXISTS products_owner_update ON public.products;
DROP POLICY IF EXISTS products_owner_delete ON public.products;
CREATE POLICY products_public_select ON public.products FOR SELECT USING (is_active OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id=store_id AND s.owner_id=auth.uid()));
CREATE POLICY products_owner_insert ON public.products FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=store_id AND s.owner_id=auth.uid()));
CREATE POLICY products_owner_update ON public.products FOR UPDATE USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=store_id AND s.owner_id=auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=store_id AND s.owner_id=auth.uid()));
CREATE POLICY products_owner_delete ON public.products FOR DELETE USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=store_id AND s.owner_id=auth.uid()));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_select_buyer_or_store ON public.orders;
CREATE POLICY orders_select_buyer_or_store ON public.orders FOR SELECT USING (user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id=store_id AND s.owner_id=auth.uid()));

ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reviews_public_select ON public.order_reviews;
DROP POLICY IF EXISTS reviews_own_update ON public.order_reviews;
DROP POLICY IF EXISTS reviews_own_delete ON public.order_reviews;
CREATE POLICY reviews_public_select ON public.order_reviews FOR SELECT USING (TRUE);
CREATE POLICY reviews_own_update ON public.order_reviews FOR UPDATE USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY reviews_own_delete ON public.order_reviews FOR DELETE USING (user_id=auth.uid());

ALTER TABLE public.product_rating_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rating_summary_public_select ON public.product_rating_summary;
CREATE POLICY rating_summary_public_select ON public.product_rating_summary FOR SELECT USING (TRUE);

ALTER TABLE public.store_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS followers_public_select ON public.store_followers;
DROP POLICY IF EXISTS followers_own_insert ON public.store_followers;
DROP POLICY IF EXISTS followers_own_delete ON public.store_followers;
CREATE POLICY followers_public_select ON public.store_followers FOR SELECT USING (TRUE);
CREATE POLICY followers_own_insert ON public.store_followers FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY followers_own_delete ON public.store_followers FOR DELETE USING (auth.uid()=user_id);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chats_participant_select ON public.chats;
DROP POLICY IF EXISTS chats_participant_insert ON public.chats;
DROP POLICY IF EXISTS chats_participant_update ON public.chats;
DROP POLICY IF EXISTS chats_participant_delete ON public.chats;
CREATE POLICY chats_participant_select ON public.chats FOR SELECT USING (auth.uid() IN (participant_1_id,participant_2_id));
CREATE POLICY chats_participant_insert ON public.chats FOR INSERT WITH CHECK (auth.uid() IN (participant_1_id,participant_2_id));
CREATE POLICY chats_participant_update ON public.chats FOR UPDATE USING (auth.uid() IN (participant_1_id,participant_2_id)) WITH CHECK (auth.uid() IN (participant_1_id,participant_2_id));
CREATE POLICY chats_participant_delete ON public.chats FOR DELETE USING (auth.uid() IN (participant_1_id,participant_2_id));

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_participant_select ON public.chat_messages;
DROP POLICY IF EXISTS messages_sender_insert ON public.chat_messages;
DROP POLICY IF EXISTS messages_participant_update ON public.chat_messages;
CREATE POLICY messages_participant_select ON public.chat_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.chats c WHERE c.id=chat_id AND auth.uid() IN (c.participant_1_id,c.participant_2_id)));
CREATE POLICY messages_sender_insert ON public.chat_messages FOR INSERT WITH CHECK (sender_id=auth.uid() AND EXISTS (SELECT 1 FROM public.chats c WHERE c.id=chat_id AND auth.uid() IN (c.participant_1_id,c.participant_2_id)));
CREATE POLICY messages_participant_update ON public.chat_messages FOR UPDATE USING (EXISTS (SELECT 1 FROM public.chats c WHERE c.id=chat_id AND auth.uid() IN (c.participant_1_id,c.participant_2_id)));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_own_select ON public.notifications;
DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
DROP POLICY IF EXISTS notifications_own_delete ON public.notifications;
CREATE POLICY notifications_own_select ON public.notifications FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY notifications_own_delete ON public.notifications FOR DELETE USING (auth.uid()=user_id);

ALTER TABLE public.merchant_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_owner_select ON public.merchant_payments;
CREATE POLICY payments_owner_select ON public.merchant_payments FOR SELECT USING (owner_id=auth.uid());

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_settings_own_select ON public.notification_settings;
DROP POLICY IF EXISTS notification_settings_own_insert ON public.notification_settings;
DROP POLICY IF EXISTS notification_settings_own_update ON public.notification_settings;
CREATE POLICY notification_settings_own_select ON public.notification_settings FOR SELECT USING (user_id=auth.uid());
CREATE POLICY notification_settings_own_insert ON public.notification_settings FOR INSERT WITH CHECK (user_id=auth.uid());
CREATE POLICY notification_settings_own_update ON public.notification_settings FOR UPDATE USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('media','media',TRUE),('avatars','avatars',TRUE)
ON CONFLICT (id) DO UPDATE SET public=EXCLUDED.public;

DROP POLICY IF EXISTS media_public_read ON storage.objects;
DROP POLICY IF EXISTS media_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS media_owner_update ON storage.objects;
DROP POLICY IF EXISTS media_owner_delete ON storage.objects;
CREATE POLICY media_public_read ON storage.objects FOR SELECT USING (bucket_id='media');
CREATE POLICY media_authenticated_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='media' AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = NULLIF((storage.foldername(name))[2], '')::uuid AND s.owner_id = auth.uid()));
CREATE POLICY media_owner_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='media' AND owner=auth.uid()) WITH CHECK (bucket_id='media' AND owner=auth.uid());
CREATE POLICY media_owner_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='media' AND owner=auth.uid());

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS avatars_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects FOR SELECT USING (bucket_id='avatars');
CREATE POLICY avatars_authenticated_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY avatars_owner_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='avatars' AND owner=auth.uid()) WITH CHECK (bucket_id='avatars' AND owner=auth.uid());
CREATE POLICY avatars_owner_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='avatars' AND owner=auth.uid());

-- Realtime tables
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_reviews; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.store_followers; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chats; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_settings; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;

-- Review reward coupons used by the existing review-success screen.
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id UUID NOT NULL UNIQUE REFERENCES public.order_reviews(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 500 CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coupons_user_created ON public.coupons(user_id, created_at DESC);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coupons_own_select ON public.coupons;
CREATE POLICY coupons_own_select ON public.coupons FOR SELECT USING (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.create_review_coupon()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_code TEXT;
BEGIN
  IF length(trim(NEW.comment)) > 0 THEN
    LOOP
      v_code := public.generate_public_code('KCP');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.coupons WHERE code=v_code);
    END LOOP;
    INSERT INTO public.coupons(user_id,review_id,code,amount,expires_at)
    VALUES(NEW.user_id,NEW.id,v_code,500,NOW()+INTERVAL '90 days')
    ON CONFLICT (review_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_create_review_coupon ON public.order_reviews;
CREATE TRIGGER trigger_create_review_coupon
AFTER INSERT ON public.order_reviews
FOR EACH ROW EXECUTE FUNCTION public.create_review_coupon();


-- Account deletion support
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
