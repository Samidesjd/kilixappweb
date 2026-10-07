-- Kilix: expand product category/template choices without invalidating legacy products.
-- Existing values remain allowed; this only widens the accepted contract.

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE NOTICE 'public.products does not exist yet; canonical migration will create it before this migration runs.';
    RETURN;
  END IF;

  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
  ALTER TABLE public.products
    ADD CONSTRAINT products_category_check
    CHECK (category IN ('electronics','clothing','home','construction','other'));

  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_template_check;
  ALTER TABLE public.products
    ADD CONSTRAINT products_template_check
    CHECK (template IN (
      'clothing','computer','phone','watch','home',
      'women','electronics','fashion_accessories','jewelry','clothing_shoes',
      'toys_hobbies','security_protection','mothers_kids','beauty_health','cars'
    ));
END $$;
