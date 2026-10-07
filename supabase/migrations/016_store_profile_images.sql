-- Dedicated public storage for per-store profile images.
-- Does not alter existing product/order/storage behavior.

INSERT INTO storage.buckets (id, name, public)
VALUES ('store-avatars', 'store-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS store_avatars_public_read ON storage.objects;
CREATE POLICY store_avatars_public_read
ON storage.objects
FOR SELECT
USING (bucket_id = 'store-avatars');

DROP POLICY IF EXISTS store_avatars_owner_insert ON storage.objects;
CREATE POLICY store_avatars_owner_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-avatars'
  AND split_part(name, '/', 1) = 'stores'
  AND EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id::text = split_part(name, '/', 2)
      AND s.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS store_avatars_owner_update ON storage.objects;
CREATE POLICY store_avatars_owner_update
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'store-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id::text = split_part(name, '/', 2)
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'store-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id::text = split_part(name, '/', 2)
      AND s.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS store_avatars_owner_delete ON storage.objects;
CREATE POLICY store_avatars_owner_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'store-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id::text = split_part(name, '/', 2)
      AND s.owner_id = auth.uid()
  )
);
