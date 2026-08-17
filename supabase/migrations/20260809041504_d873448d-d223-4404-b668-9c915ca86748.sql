-- Contacts
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  is_favorite boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_select_own ON public.contacts FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY contacts_insert_own ON public.contacts FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND contact_id <> auth.uid());
CREATE POLICY contacts_update_own ON public.contacts FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY contacts_delete_own ON public.contacts FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Status media support
ALTER TABLE public.statuses ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text';
ALTER TABLE public.statuses ADD COLUMN IF NOT EXISTS duration_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.statuses ADD COLUMN IF NOT EXISTS caption text;
