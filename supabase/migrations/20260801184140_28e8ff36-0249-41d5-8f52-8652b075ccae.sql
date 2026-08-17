DROP POLICY IF EXISTS participants_insert ON public.conversation_participants;

CREATE POLICY participants_insert ON public.conversation_participants
FOR INSERT TO authenticated
WITH CHECK (
  private.is_conversation_admin(conversation_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_participants.conversation_id
      AND c.created_by = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.guard_participant_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND NOT private.is_conversation_admin(OLD.conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only conversation admins can change admin status';
  END IF;
  NEW.conversation_id := OLD.conversation_id;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_participant_admin_flag() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_participant_admin_flag ON public.conversation_participants;
CREATE TRIGGER guard_participant_admin_flag
BEFORE UPDATE ON public.conversation_participants
FOR EACH ROW EXECUTE FUNCTION public.guard_participant_admin_flag();