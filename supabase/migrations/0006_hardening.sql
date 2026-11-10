-- ═══════════════════════════════════════════════════════════════
-- 0006 — hardening, verified against a live project.
--
-- Everything in this file was found by applying the schema to a
-- real Postgres 17 instance and probing it, rather than by reading
-- the SQL. Parsing the DDL is not the same as running it.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. `anon` must not be able to call the signed-in RPCs ─────
--
-- By default PostgREST exposes every function to `anon` as well as
-- `authenticated`. These functions read a signed-in user's private
-- content, so `anon` must not be able to call them at all.
--
-- `revoke … from public` alone is not enough here: the platform
-- grants EXECUTE on new functions to `anon` and `authenticated`
-- explicitly, so the anonymous role keeps its access unless it is
-- revoked by name.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'retrieve_guarded',
        'retrieve_guarded_semantic',
        'retrieve_notes',
        'search_vault',
        'reindex_note_links',
        'connect_source',
        'import_remote_series',
        'save_progress',
        'save_note'
      )
  loop
    execute format('revoke execute on function %s from public', f.sig);
    execute format('revoke execute on function %s from anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- ─── 2. TRUNCATE is not covered by Row Level Security ──────────
--
-- RLS filters SELECT/INSERT/UPDATE/DELETE. TRUNCATE is a separate
-- command that never consults a policy, so the privilege alone
-- decides. Supabase grants ALL PRIVILEGES on the public schema's
-- tables to `anon` and `authenticated` by default, which means
-- anybody holding the public anon key could have wiped every user's
-- rows with a single statement.
--
-- The application never truncates a table, so the privilege is
-- simply removed. TRUNCATE stays with the owner and the service
-- role.
do $$
declare
  t record;
begin
  for t in
    select c.oid::regclass::text as sig
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('revoke truncate on table %s from anon', t.sig);
    execute format('revoke truncate on table %s from authenticated', t.sig);
  end loop;
end $$;
