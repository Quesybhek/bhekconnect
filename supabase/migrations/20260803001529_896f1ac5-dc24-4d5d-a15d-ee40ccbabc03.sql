ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.conversations SET kind = 'group' WHERE is_group = true AND kind = 'direct';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status_privacy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS last_seen_privacy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS photo_privacy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS read_receipts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS wallpaper text NOT NULL DEFAULT 'emerald';

CREATE INDEX IF NOT EXISTS conversations_community_id_idx ON public.conversations (community_id);
CREATE INDEX IF NOT EXISTS conversations_kind_idx ON public.conversations (kind);