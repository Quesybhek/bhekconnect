-- 1. Private helper schema (not exposed via the Data API)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_conversation_admin(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id AND is_admin
  );
$$;

REVOKE ALL ON FUNCTION private.is_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_conversation_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_participant(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_conversation_admin(uuid, uuid) TO authenticated, service_role;

-- 2. Recreate policies against the private helpers
DROP POLICY IF EXISTS conversations_select ON public.conversations;
DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated
  USING (private.is_participant(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY conversations_update ON public.conversations FOR UPDATE TO authenticated
  USING (private.is_participant(id, auth.uid())) WITH CHECK (private.is_participant(id, auth.uid()));

DROP POLICY IF EXISTS participants_select ON public.conversation_participants;
DROP POLICY IF EXISTS participants_insert ON public.conversation_participants;
DROP POLICY IF EXISTS participants_update_own ON public.conversation_participants;
DROP POLICY IF EXISTS participants_delete ON public.conversation_participants;
CREATE POLICY participants_select ON public.conversation_participants FOR SELECT TO authenticated
  USING (private.is_participant(conversation_id, auth.uid()));
CREATE POLICY participants_insert ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR private.is_conversation_admin(conversation_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );
CREATE POLICY participants_update_own ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_conversation_admin(conversation_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR private.is_conversation_admin(conversation_id, auth.uid()));
CREATE POLICY participants_delete ON public.conversation_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_conversation_admin(conversation_id, auth.uid()));

DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (private.is_participant(conversation_id, auth.uid()));
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND private.is_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS reactions_select ON public.message_reactions;
DROP POLICY IF EXISTS reactions_insert ON public.message_reactions;
CREATE POLICY reactions_select ON public.message_reactions FOR SELECT TO authenticated
  USING (private.is_participant(conversation_id, auth.uid()));
CREATE POLICY reactions_insert ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.is_participant(conversation_id, auth.uid()));

DROP FUNCTION IF EXISTS public.is_participant(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_conversation_admin(uuid, uuid);

-- 3. Trigger functions must not be callable by API roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 4. Move phone numbers into an owner-only table
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_contacts TO authenticated;
GRANT ALL ON public.profile_contacts TO service_role;

ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_contacts_select_own ON public.profile_contacts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY profile_contacts_insert_own ON public.profile_contacts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_contacts_update_own ON public.profile_contacts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_contacts_delete_own ON public.profile_contacts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.profile_contacts (user_id, phone)
SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

DROP TRIGGER IF EXISTS profile_contacts_updated_at ON public.profile_contacts;
CREATE TRIGGER profile_contacts_updated_at BEFORE UPDATE ON public.profile_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Media objects are readable only by their uploader
DROP POLICY IF EXISTS media_read ON storage.objects;
CREATE POLICY media_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);