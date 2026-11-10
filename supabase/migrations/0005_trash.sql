-- ══════════════════════════════════════════════════════════════
-- 0005 — the trash
--
-- Deleting something in Shelf is never final straight away. The row
-- is snapshotted here, so it can be put back; entries are purged
-- after 30 days.
-- ══════════════════════════════════════════════════════════════

create table if not exists public.trash (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('note','item','deck','card','clip')),
  entity_id uuid not null,
  label text not null default 'Untitled',
  -- A snapshot of the deleted row (and, for an item, its pages).
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists trash_user_idx on public.trash(user_id, deleted_at desc);
create index if not exists trash_expired_idx on public.trash(deleted_at);

alter table public.trash enable row level security;

drop policy if exists trash_select_own on public.trash;
create policy trash_select_own on public.trash
  for select using (user_id = auth.uid());

drop policy if exists trash_insert_own on public.trash;
create policy trash_insert_own on public.trash
  for insert with check (user_id = auth.uid());

drop policy if exists trash_update_own on public.trash;
create policy trash_update_own on public.trash
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists trash_delete_own on public.trash;
create policy trash_delete_own on public.trash
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.trash to authenticated;
grant usage, select on sequence public.trash_id_seq to authenticated;
