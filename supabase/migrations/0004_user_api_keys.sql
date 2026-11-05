-- ══════════════════════════════════════════════════════════════
-- 0004 — user-supplied provider keys.
--
-- A user may bring their own AI provider key. The key is encrypted
-- with AES-256-GCM by the application before it is written here, so
-- this table only ever holds ciphertext.
-- ══════════════════════════════════════════════════════════════

create table if not exists user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists user_api_keys_user_idx on user_api_keys(user_id);

alter table user_api_keys enable row level security;

drop policy if exists "user_api_keys own rows" on user_api_keys;
create policy "user_api_keys own rows" on user_api_keys
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nothing else should be able to read these rows, even with a
-- service-role key, except the worker (which never uses them).
revoke all on user_api_keys from anon, authenticated;
grant select, insert, update, delete on user_api_keys to authenticated;
-- The id comes from gen_random_uuid(), so there is no sequence to grant.
