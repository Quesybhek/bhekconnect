-- BhekConnect communities and channels
alter table public.conversations add column if not exists kind text not null default 'chat';
alter table public.conversations drop constraint if exists conversations_kind_check;
alter table public.conversations add constraint conversations_kind_check check (kind in ('chat','group','community','announcement','channel','ai'));
create table if not exists public.communities (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text default '',
 avatar_url text,
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.community_conversations (
 community_id uuid not null references public.communities(id) on delete cascade,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 primary key(community_id,conversation_id)
);
create table if not exists public.channels (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null unique references public.conversations(id) on delete cascade,
 handle text unique not null,
 category text default 'General',
 is_public boolean not null default true,
 follower_count integer not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.channel_followers (
 channel_id uuid not null references public.channels(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 notifications_enabled boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(channel_id,user_id)
);
create table if not exists public.message_views (
 message_id uuid not null references public.messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 viewed_at timestamptz not null default now(),
 primary key(message_id,user_id)
);
create table if not exists public.scheduled_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text,
 send_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.communities enable row level security;
alter table public.community_conversations enable row level security;
alter table public.channels enable row level security;
alter table public.channel_followers enable row level security;
alter table public.message_views enable row level security;
alter table public.scheduled_messages enable row level security;
create policy communities_read on public.communities for select to authenticated using (true);
create policy communities_create on public.communities for insert to authenticated with check(owner_id=auth.uid());
create policy communities_update on public.communities for update to authenticated using(owner_id=auth.uid());
create policy community_links_read on public.community_conversations for select to authenticated using(true);
create policy community_links_write on public.community_conversations for all to authenticated using(
 exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid())
) with check(
 exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid())
);
create policy channels_read on public.channels for select to authenticated using(is_public or exists(select 1 from public.channel_followers f where f.channel_id=id and f.user_id=auth.uid()));
create policy channel_follow on public.channel_followers for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy message_views_own on public.message_views for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy scheduled_own on public.scheduled_messages for all to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid());


-- Production channel/community membership and publishing support
create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin','owner')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_members enable row level security;
create policy community_members_read on public.community_members for select to authenticated
  using (user_id = auth.uid() or exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()));
create policy community_members_join on public.community_members for insert to authenticated
  with check (user_id=auth.uid() or exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()));
create policy community_members_manage on public.community_members for update to authenticated
  using (exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()))
  with check (exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()));
create policy community_members_leave on public.community_members for delete to authenticated
  using (user_id=auth.uid() or exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()));

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text,
  media_url text,
  kind text not null default 'text' check (kind in ('text','image','video','audio','file','poll')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists channel_posts_channel_created_idx on public.channel_posts(channel_id, created_at desc);
alter table public.channel_posts enable row level security;
create policy channel_posts_read on public.channel_posts for select to authenticated
  using (exists(select 1 from public.channels c where c.id=channel_id and (c.is_public or exists(select 1 from public.channel_followers f where f.channel_id=c.id and f.user_id=auth.uid()))));
create policy channel_posts_write on public.channel_posts for insert to authenticated
  with check (author_id=auth.uid() and exists(select 1 from public.channels c where c.id=channel_id and exists(select 1 from public.conversations cv where cv.id=c.conversation_id and cv.created_by=auth.uid())));
create policy channel_posts_update on public.channel_posts for update to authenticated
  using (author_id=auth.uid()) with check (author_id=auth.uid());
create policy channel_posts_delete on public.channel_posts for delete to authenticated
  using (author_id=auth.uid());

create or replace function public.sync_channel_follower_count()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.channels set follower_count=(select count(*) from public.channel_followers f where f.channel_id=coalesce(new.channel_id,old.channel_id))
  where id=coalesce(new.channel_id,old.channel_id);
  return coalesce(new,old);
end; $$;
drop trigger if exists channel_follower_count_sync on public.channel_followers;
create trigger channel_follower_count_sync after insert or delete on public.channel_followers
for each row execute function public.sync_channel_follower_count();

-- Channel creators are automatically followers so their own publishing surface is immediately usable.
create or replace function public.create_channel_owner_follower()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.channel_followers(channel_id,user_id) values(new.id,(select created_by from public.conversations where id=new.conversation_id)) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists channel_owner_follower on public.channels;
create trigger channel_owner_follower after insert on public.channels
for each row execute function public.create_channel_owner_follower();
