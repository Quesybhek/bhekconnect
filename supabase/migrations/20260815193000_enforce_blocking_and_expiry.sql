-- Enforce contact blocking at the database level (it was previously UI-only:
-- the "Block contact" screen wrote to contacts.is_blocked but nothing ever
-- checked it before allowing a message or call to go through).
--
-- Also enforce disappearing-message expiry at the database level (it was
-- previously client-only: expired messages stayed in the table forever and
-- were fully readable to anyone querying the API directly).

-- 1. Helper: are two users blocked in either direction?
CREATE OR REPLACE FUNCTION private.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contacts
    WHERE is_blocked
      AND ((owner_id = _a AND contact_id = _b) OR (owner_id = _b AND contact_id = _a))
  );
$$;
REVOKE ALL ON FUNCTION private.is_blocked_between(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_blocked_between(uuid, uuid) TO authenticated, service_role;

-- 2. Helper: the other member of a *direct* (non-group) conversation.
CREATE OR REPLACE FUNCTION private.other_direct_participant(_conversation_id uuid, _user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cp.user_id
  FROM public.conversation_participants cp
  JOIN public.conversations c ON c.id = cp.conversation_id
  WHERE cp.conversation_id = _conversation_id
    AND c.is_group = false
    AND cp.user_id <> _user_id
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.other_direct_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.other_direct_participant(uuid, uuid) TO authenticated, service_role;

-- 3. Messages: reject sends in a direct conversation where either side has
-- blocked the other. Group conversations are unaffected (WhatsApp-style:
-- blocking only applies to 1:1 messages/calls, not shared groups).
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND private.is_participant(conversation_id, auth.uid())
    AND NOT private.is_blocked_between(
      auth.uid(),
      COALESCE(private.other_direct_participant(conversation_id, auth.uid()), auth.uid())
    )
  );

-- 4. Calls: reject logging/starting a call between two users who have
-- blocked each other. callee_id is nullable for group calls, which are
-- untouched by this check (COALESCE falls back to caller_id, which can
-- never be "blocked" against itself since contacts forbids self-rows).
DROP POLICY IF EXISTS calls_insert ON public.calls;
CREATE POLICY calls_insert ON public.calls FOR INSERT TO authenticated
  WITH CHECK (
    caller_id = auth.uid()
    AND NOT private.is_blocked_between(caller_id, COALESCE(callee_id, caller_id))
  );

-- 5. Disappearing messages: once expires_at has passed, the row becomes
-- invisible to every participant at the RLS layer -- not just filtered out
-- by the client after the fact.
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (
    private.is_participant(conversation_id, auth.uid())
    AND (expires_at IS NULL OR expires_at > now())
  );

-- 6. Actually wipe expired messages instead of leaving them hidden-but-present
-- forever. Reuses the same "soft delete" shape as the existing delete flow
-- (deleteMessage in src/lib/chat.ts) so expired rows look identical to a
-- message the sender deleted themselves.
CREATE OR REPLACE FUNCTION public.purge_expired_messages()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.messages
  SET body = NULL, media_url = NULL, kind = 'text', deleted_at = now()
  WHERE expires_at IS NOT NULL
    AND expires_at <= now()
    AND deleted_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_messages() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_messages() TO service_role;

-- 7. Try to schedule the purge every 10 minutes via pg_cron. Not every
-- Supabase project/plan has pg_cron enabled, so this is best-effort: if it
-- fails, the function above still exists and can be scheduled another way
-- (Supabase Dashboard -> Database -> Cron Jobs, or an external scheduler /
-- edge function hitting `select public.purge_expired_messages();`).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  PERFORM cron.schedule(
    'purge-expired-messages',
    '*/10 * * * *',
    $job$SELECT public.purge_expired_messages();$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable on this project -- schedule public.purge_expired_messages() manually.';
END $$;
