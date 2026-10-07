-- Kilix: keep product size/color options extensible.
-- The application stores options as TEXT[] so merchants can use the built-in
-- catalog options or add their own custom labels. No per-value CHECK constraint
-- is introduced, intentionally allowing future/custom options to reach buyers.

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'public.products table does not exist; apply the canonical schema first';
  END IF;

  ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS sizes TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS colors TEXT[] NOT NULL DEFAULT '{}';

  UPDATE public.products
  SET
    sizes = COALESCE(sizes, '{}'),
    colors = COALESCE(colors, '{}')
  WHERE sizes IS NULL OR colors IS NULL;
END $$;
