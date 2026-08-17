
-- shared conversation media reads
CREATE POLICY "media_read_conversation" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND private.is_participant(((storage.foldername(name))[2])::uuid, auth.uid())
);

-- starred messages
CREATE TABLE public.message_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.message_stars TO authenticated;
GRANT ALL ON public.message_stars TO service_role;

ALTER TABLE public.message_stars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stars_select_own" ON public.message_stars
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "stars_insert_own" ON public.message_stars
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND private.is_participant(conversation_id, auth.uid()));
CREATE POLICY "stars_delete_own" ON public.message_stars
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- archived chats
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- realtime for membership changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
