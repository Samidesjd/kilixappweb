-- Kilix: production-safe repair for the products template/category constraints.
-- This migration is intentionally idempotent so it can repair an existing
-- Supabase database where the older products_template_check is still active.
-- No application/runtime/Android configuration is changed by this migration.

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'public.products table does not exist; apply the canonical schema before this migration';
  END IF;

  -- Remove the legacy constraints by their canonical names before recreating
  -- the complete allowed-value contract used by the current application.
  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_template_check;
  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;

  ALTER TABLE public.products
    ADD CONSTRAINT products_category_check
    CHECK (category IN ('electronics','clothing','home','construction','other'));

  ALTER TABLE public.products
    ADD CONSTRAINT products_template_check
    CHECK (template IN (
      'clothing',
      'computer',
      'phone',
      'watch',
      'home',
      'women',
      'electronics',
      'fashion_accessories',
      'jewelry',
      'clothing_shoes',
      'toys_hobbies',
      'security_protection',
      'mothers_kids',
      'beauty_health',
      'cars'
    ));
END $$;
