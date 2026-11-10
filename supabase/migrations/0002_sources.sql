-- ═══════════════════════════════════════════════════════════════
-- Shelf — public sources.
--
-- A "source" is one language of one extension from the public
-- Mihon/Tachiyomi extension catalog (keiyoushi/extensions).
-- Users connect the ones they want; Shelf then browses and imports
-- from them using a provider adapter.
--
-- Imported manga becomes a regular series + items, so the reader,
-- notes, quiz and graph all work exactly as they do for uploads.
-- ═══════════════════════════════════════════════════════════════

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- provider key: 'mangadex' | 'madara' | …
  provider text not null default 'catalog',
  -- `${packageName}#${catalogSourceId}` — stable across catalog updates
  source_key text not null,
  package_name text not null,
  catalog_id text not null,
  name text not null,
  language text not null,
  home_url text,
  icon_path text,
  adapter text,
  nsfw boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create index if not exists sources_user_idx on sources(user_id);

-- Items gain a remote origin.
alter table items add column if not exists source_id uuid references sources(id) on delete set null;
alter table items add column if not exists remote_id text;
alter table items add column if not exists remote_chapter_id text;
alter table items add column if not exists origin text not null default 'upload';
alter table items add column if not exists remote_cover_url text;

create index if not exists items_source_idx on items(source_id);
create index if not exists items_remote_idx on items(user_id, origin);

-- RLS, matching the rest of the schema.
alter table sources enable row level security;

drop policy if exists "own sources" on sources;
create policy "own sources" on sources for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Keep the unique index that the original schema relied on, but make
-- sure the new columns are covered by the item policies (they are —
-- item policies key off user_id only).

-- ─── Helper: connect a source, or return the existing connection ───
-- The user comes from the JWT, never from a parameter: these
-- functions are SECURITY DEFINER, so a parameter would let any
-- caller write into another user's account.
create or replace function connect_source(
  p_package_name text,
  p_catalog_id text,
  p_name text,
  p_language text,
  p_home_url text default null,
  p_icon_path text default null,
  p_adapter text default null,
  p_nsfw boolean default false
)
returns sources
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_row sources;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  v_key := p_package_name || '#' || p_catalog_id;

  insert into sources (
    user_id, provider, source_key, package_name, catalog_id,
    name, language, home_url, icon_path, adapter, nsfw
  )
  values (
    v_user_id, coalesce(p_adapter, 'catalog'), v_key, p_package_name, p_catalog_id,
    p_name, p_language, p_home_url, p_icon_path, p_adapter, p_nsfw
  )
  on conflict (user_id, source_key) do update
    set name = excluded.name,
        language = excluded.language,
        home_url = excluded.home_url,
        icon_path = excluded.icon_path,
        adapter = excluded.adapter,
        nsfw = excluded.nsfw
  returning * into v_row;

  return v_row;
end;
$$;

-- ─── Helper: import a remote manga as a series + items ────────────
create or replace function import_remote_series(
  p_source_id uuid,
  p_remote_id text,
  p_title text,
  p_author text default null,
  p_description text default null,
  p_cover_url text default null,
  p_genres text[] default '{}',
  p_chapters jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
-- `extensions` is on the path because pgcrypto lives there on
-- Supabase, and this function calls digest(). With the path pinned
-- to `public` alone the call failed at runtime with
-- "function digest(text, unknown) does not exist" — the function
-- compiled, because PL/pgSQL only resolves the name when it runs.
set search_path = public, extensions
as $$
declare
  v_series_id uuid;
  v_item_ids jsonb := '[]'::jsonb;
  v_chapter jsonb;
  v_item_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- The series itself.
  -- Re-importing the same title has to be idempotent: the series
  -- table is unique on (user_id, title), so a plain insert raised
  -- "duplicate key value violates unique constraint
  -- series_user_id_title_key" the second time a user imported the
  -- same manga. The existing series is reused instead.
  insert into series (user_id, title, kind)
  values (v_user_id, p_title, 'manga')
  on conflict (user_id, title) do update
    set title = excluded.title
  returning id into v_series_id;

  -- One item per chapter, so progress tracking works per chapter.
  -- `select value`, not `select *`: `select *` returns the raw
  -- jsonb element as a record, and the loop variable is a jsonb.
  for v_chapter in select value from jsonb_array_elements(p_chapters)
  loop
    insert into items (
      user_id, series_id, type, title, chapter, volume,
      file_hash, original_path, cover_path, page_count, status, origin,
      source_id, remote_id, remote_chapter_id, remote_cover_url
    )
    values (
      v_user_id, v_series_id, 'cbz',
      p_title || (case when (v_chapter->>'number') is not null
                        then ' c' || (v_chapter->>'number') else '' end),
      nullif(v_chapter->>'number', '')::numeric,
      nullif(v_chapter->>'volume', '')::numeric,
      encode(digest(p_source_id::text || ':' || coalesce(v_chapter->>'id', ''), 'sha256'), 'hex'),
      'remote://' || p_source_id::text || '/' || coalesce(v_chapter->>'id', ''),
      p_cover_url,
      -- `(a, b)` is a ROW constructor, so `(v_chapter->>'pageCount', '')::int`
      -- tried to cast a record to an integer and raised
      -- "cannot cast type record to integer". nullif() is the
      -- fallback that was meant.
      coalesce(nullif(v_chapter->>'pageCount', '')::int, 0),
      'processing', 'remote', p_source_id, p_remote_id,
      v_chapter->>'id', p_cover_url
    )
    -- The chapter hash is derived from the source and the chapter id,
    -- so re-importing the same chapter hits the unique constraint.
    -- The existing row is refreshed instead.
    on conflict (user_id, file_hash) do update
      set series_id = excluded.series_id,
          title = excluded.title,
          page_count = excluded.page_count,
          cover_path = excluded.cover_path,
          remote_cover_url = excluded.remote_cover_url
    returning id into v_item_id;

    v_item_ids := v_item_ids || jsonb_build_array(v_item_id);
  end loop;

  -- Enqueue the fetch stage for each imported chapter.
  -- A chapter that was already imported keeps its job, so a second
  -- import does not queue the same fetch twice.
  insert into jobs (user_id, item_id, stage, status)
  select v_user_id, x::uuid, 'remote', 'queued'
  from jsonb_array_elements_text(v_item_ids) as x
  where not exists (
    select 1 from jobs j
    where j.user_id = v_user_id and j.item_id = x::uuid and j.stage = 'remote'
  );

  return jsonb_build_object('seriesId', v_series_id, 'itemIds', v_item_ids);
end;
$$;
