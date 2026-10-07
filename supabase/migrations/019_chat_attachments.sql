-- Chat attachments: private storage + message metadata
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size BIGINT;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN ('text','image','video','file'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

DROP POLICY IF EXISTS chat_media_select ON storage.objects;
DROP POLICY IF EXISTS chat_media_insert ON storage.objects;
DROP POLICY IF EXISTS chat_media_delete ON storage.objects;

CREATE POLICY chat_media_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = NULLIF((storage.foldername(name))[1], '')::uuid
      AND auth.uid() IN (c.participant_1_id, c.participant_2_id)
  )
);

CREATE POLICY chat_media_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND NULLIF((storage.foldername(name))[2], '')::uuid = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = NULLIF((storage.foldername(name))[1], '')::uuid
      AND auth.uid() IN (c.participant_1_id, c.participant_2_id)
  )
);

CREATE POLICY chat_media_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND owner = auth.uid()
);
