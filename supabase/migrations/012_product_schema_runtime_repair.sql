-- Kilix: definitive runtime repair for the products schema.
--
-- Why this exists:
-- Some existing Supabase databases were created from an older products schema
-- and can still contain a legacy CHECK constraint (sometimes under a different
-- constraint name). The application now supports additional product templates
-- and catalog fields, so repairing only the old canonical constraint name is
-- not sufficient.
--
-- This migration is idempotent and safe to run against both fresh and existing
-- Kilix databases. It does not remove product data or change application logic.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'public.products table does not exist; apply the canonical schema before this migration';
  END IF;

  -- Ensure every catalog field used by the current application exists.
  ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS sizes TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS colors TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ram TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS storage TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS videos TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS min_order_quantity INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS max_order_quantity INTEGER NOT NULL DEFAULT 1000000;

  -- Drop every CHECK constraint whose expression still validates `template`.
  -- This catches legacy constraints even when their names differ from the
  -- expected products_template_check name.
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.products'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%template%'
  LOOP
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  -- Drop every CHECK constraint whose expression validates `category`, then
  -- install the current application contract.
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.products'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', constraint_name);
  END LOOP;

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

  -- Keep quantity validation consistent with the application.
  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_min_order_quantity_check;
  ALTER TABLE public.products
    ADD CONSTRAINT products_min_order_quantity_check
    CHECK (min_order_quantity >= 1);

  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_max_order_quantity_check;
  ALTER TABLE public.products
    ADD CONSTRAINT products_max_order_quantity_check
    CHECK (max_order_quantity >= min_order_quantity);
END $$;
