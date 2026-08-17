-- BhekConnect production-ready core schema. Enable RLS and connect realtime/storage in Supabase.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique,
 display_name text not null default '',
 avatar_url text,
 about text default '',
 created_at timestamptz not null default now()
);
create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('direct','group','community','channel','ai')),
 name text not null,
 description text default '',
 avatar_url text,
 owner_id uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
 conversation_id uuid references public.conversations(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('member','admin','owner')),
 joined_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text,
 message_type text not null default 'text',
 attachment_url text,
 reply_to uuid references public.messages(id),
 edited_at timestamptz,
 deleted_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.message_reactions (
 message_id uuid references public.messages(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 emoji text not null,
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,emoji)
);
create table if not exists public.message_stars (
 message_id uuid references public.messages(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(message_id,user_id)
);
create table if not exists public.groups (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 max_members integer not null default 1024,
 approval_required boolean not null default false,
 announcements_only boolean not null default false
);
create table if not exists public.communities (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text default '',
 owner_id uuid references auth.users(id),
 announcement_conversation_id uuid references public.conversations(id),
 created_at timestamptz not null default now()
);
create table if not exists public.community_groups (
 community_id uuid references public.communities(id) on delete cascade,
 conversation_id uuid references public.conversations(id) on delete cascade,
 primary key(community_id,conversation_id)
);
create table if not exists public.channels (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 handle text unique,
 follower_count integer not null default 0
);
create table if not exists public.channel_followers (
 conversation_id uuid references public.channels(conversation_id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);
create table if not exists public.status_updates (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('text','image','video','voice')),
 body text,
 media_url text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '24 hours'
);
create table if not exists public.calls (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid,
 caller_id uuid not null references auth.users(id),
 kind text not null check (kind in ('voice','video')),
 started_at timestamptz,
 ended_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at desc);
create index if not exists status_user_expires_idx on public.status_updates(user_id,expires_at);
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_stars enable row level security;
alter table public.status_updates enable row level security;
