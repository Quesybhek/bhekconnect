-- Production transport primitives: WebRTC signaling, push subscriptions and direct-chat key exchange.
create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice','hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists call_signals_recipient_created_idx on public.call_signals(recipient_id,created_at);
alter table public.call_signals enable row level security;
create policy call_signals_select on public.call_signals for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy call_signals_insert on public.call_signals for insert to authenticated
with check (sender_id = auth.uid());
create policy call_signals_delete on public.call_signals for delete to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.device_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key jsonb not null,
  algorithm text not null default 'ECDH-P256-AES-GCM',
  updated_at timestamptz not null default now()
);
alter table public.device_keys enable row level security;
create policy device_keys_read_authenticated on public.device_keys for select to authenticated using (true);
create policy device_keys_write_own on public.device_keys for insert to authenticated with check (user_id = auth.uid());
create policy device_keys_update_own on public.device_keys for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.messages add column if not exists encrypted_body text;
alter table public.messages add column if not exists encryption_iv text;
alter table public.messages add column if not exists encryption_version integer not null default 0;

alter table public.calls add column if not exists kind text;
alter table public.calls add column if not exists started_at timestamptz;
alter table public.calls add column if not exists ended_at timestamptz;
update public.calls set kind = case when is_video then 'video' else 'voice' end where kind is null;
alter table public.calls alter column kind set default 'voice';
alter table public.calls drop constraint if exists calls_kind_check;
alter table public.calls add constraint calls_kind_check check (kind in ('voice','video'));
alter table public.calls alter column status set default 'ringing';
create index if not exists call_signals_call_idx on public.call_signals(call_id,created_at);

do $$ begin
  alter publication supabase_realtime add table public.call_signals;
exception when duplicate_object then null; end $$;
