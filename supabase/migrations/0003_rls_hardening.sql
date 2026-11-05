-- ═══════════════════════════════════════════════════════════════
-- Shelf — RLS hardening.
--
-- The first two migrations created several `security definer`
-- functions that took the user's id as a *parameter*:
--
--     retrieve_guarded(p_user_id, …)
--     retrieve_guarded_semantic(p_user_id, …)
--     retrieve_notes(p_user_id, …)
--     connect_source(p_user_id, …)
--     import_remote_series(p_user_id, …)
--
-- Because they are SECURITY DEFINER they bypass Row Level Security,
-- so any authenticated caller could pass somebody else's id and read
-- their content — including pages they had not read yet, which
-- defeats the spoiler guard for that user.
--
-- This migration re-creates them with `auth.uid()` instead, and
-- tightens who may execute them at all.
--
-- It is safe to run against a database that already has 0001/0002
-- applied: every statement here is idempotent.
-- ═══════════════════════════════════════════════════════════════

-- ─── search_vault ─────────────────────────────────────────────
-- Same definition as 0001, with one fix: the semantic CTE used to
-- run even when no query embedding was available. `embedding <=>
-- NULL` is NULL for every row, so the CTE returned 50 arbitrary
-- items that were then fused into the ranking.
create or replace function search_vault(
  query_text text,
  query_embedding vector(1536) default null,
  match_limit int default 20,
  search_mode text default 'hybrid'
)
returns table (
  id text,
  kind text,
  title text,
  snippet text,
  href text,
  meta text,
  rank double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with kw as (
    select i.id, i.title,
           ts_rank(to_tsvector('english', coalesce(i.ai_summary,'') || ' ' || i.title),
                   plainto_tsquery('english', query_text)) as r
    from items i
    where i.user_id = auth.uid()
      and search_mode <> 'semantic'
      and to_tsvector('english', coalesce(i.ai_summary,'') || ' ' || i.title)
          @@ plainto_tsquery('english', query_text)
    limit 50
  ),
  kw_notes as (
    select n.id, n.title,
           ts_rank(to_tsvector('english', n.title || ' ' || n.body_md),
                   plainto_tsquery('english', query_text)) as r
    from notes n
    where n.user_id = auth.uid()
      and search_mode <> 'semantic'
      and to_tsvector('english', n.title || ' ' || n.body_md)
          @@ plainto_tsquery('english', query_text)
    limit 50
  ),
  sem as (
    select i.id, i.title, (i.embedding <=> query_embedding)::double precision as r
    from items i
    where i.user_id = auth.uid()
      and search_mode <> 'keyword'
      and i.embedding is not null
      and query_embedding is not null
    order by i.embedding <=> query_embedding
    limit 50
  ),
  fused as (
    select id, title, 1.0 / (60 + row_number() over (order by r desc)) as rrf, 'item'::text as kind
    from kw
    union all
    select id, title, 1.0 / (60 + row_number() over (order by r desc)), 'note'
    from kw_notes
    union all
    select id, title, 1.0 / (60 + row_number() over (order by r asc)), 'item'
    from sem
  )
  select
    f.id::text,
    f.kind,
    f.title,
    coalesce(i.ai_summary, n.body_md, '') as snippet,
    case when f.kind = 'note' then '/app/notes/' || f.id::text else '/app/item/' || f.id::text end as href,
    null::text as meta,
    sum(f.rrf) over (partition by f.id) as rank
  from fused f
  left join items i on i.id = f.id
  left join notes n on n.id = f.id
  group by f.id, f.kind, f.title, i.ai_summary, n.body_md
  order by rank desc
  limit greatest(1, least(match_limit, 100));
$$;

-- ─── retrieve_guarded ──────────────────────────────────────────
create or replace function retrieve_guarded(
  p_item_ids uuid[],
  p_query text default '',
  p_query_embedding vector(1536) default null,
  p_limit int default 8
)
returns table (
  content text,
  item_id uuid,
  item_title text,
  page_start int,
  page_end int,
  score double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select
      c.item_id,
      c.page_start,
      c.page_end,
      c.content,
      i.title as item_title
    from chunks c
    join items i on i.id = c.item_id
    left join progress pr
      on pr.item_id = c.item_id and pr.user_id = auth.uid()
    where c.user_id = auth.uid()
      and (p_item_ids is null or c.item_id = any(p_item_ids))
      -- ▼▼▼ THE SPOILER GUARD ▼▼▼
      and c.page_end <= coalesce(pr.max_page_read, 0)
      -- ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲
  )
  select
    e.content,
    e.item_id,
    e.item_title,
    e.page_start,
    e.page_end,
    ts_rank(
      to_tsvector('english', e.content),
      plainto_tsquery('english', coalesce(nullif(p_query, ''), 'the'))
    )::double precision as score
  from eligible e
  order by score desc, e.page_start
  limit greatest(1, least(p_limit, 50));
$$;

-- ─── retrieve_guarded_semantic ─────────────────────────────────
create or replace function retrieve_guarded_semantic(
  p_item_ids uuid[],
  p_query_embedding vector(1536),
  p_limit int default 8
)
returns table (
  content text,
  item_id uuid,
  item_title text,
  page_start int,
  page_end int,
  score double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.content,
    c.item_id,
    i.title as item_title,
    c.page_start,
    c.page_end,
    (c.embedding <=> p_query_embedding)::double precision as score
  from chunks c
  join items i on i.id = c.item_id
  left join progress pr
    on pr.item_id = c.item_id and pr.user_id = auth.uid()
  where c.user_id = auth.uid()
    and (p_item_ids is null or c.item_id = any(p_item_ids))
    -- ▼▼▼ THE SPOILER GUARD ▼▼▼
    and c.page_end <= coalesce(pr.max_page_read, 0)
    -- ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲
  order by c.embedding <=> p_query_embedding
  limit greatest(1, least(p_limit, 50));
$$;

-- ─── retrieve_notes ────────────────────────────────────────────
create or replace function retrieve_notes(
  p_query text default '',
  p_query_embedding vector(1536) default null,
  p_limit int default 6
)
returns table (id uuid, title text, body_md text, score double precision)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id, n.title, n.body_md,
    case when p_query_embedding is not null
      then (n.embedding <=> p_query_embedding)::double precision
      else ts_rank(to_tsvector('english', n.title || ' ' || n.body_md),
                   plainto_tsquery('english', p_query))
    end as score
  from notes n
  where n.user_id = auth.uid()
    and (p_query = '' or to_tsvector('english', n.title || ' ' || n.body_md)
         @@ plainto_tsquery('english', p_query)
         or n.title ilike '%' || p_query || '%')
  order by score desc
  limit greatest(1, least(p_limit, 50));
$$;

-- ─── reindex_note_links: invoker, so RLS guards the link index ──
create or replace function reindex_note_links(p_note_id uuid, p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  body text;
begin
  select n.body_md into body from notes n where n.id = p_note_id and n.user_id = p_user_id;
  if body is null then return; end if;

  delete from links where from_note = p_note_id and user_id = p_user_id;

  insert into links (user_id, from_note, to_note, to_item, to_page, kind)
  select
    p_user_id,
    p_note_id,
    matched_note.id,
    matched_item.id,
    (regexp_match(m.raw, 'p(\d+)', 'i'))[1]::int,
    'wikilink'
  from (
    select (regexp_matches(body, '\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]', 'g'))[1] as target,
           (regexp_matches(body, '\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]', 'g'))[2] as anchor,
           (regexp_matches(body, '\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]', 'g'))[0] as raw
  ) m
  left join notes matched_note on lower(matched_note.title) = lower(m.target) and matched_note.user_id = p_user_id
  left join items matched_item on lower(matched_item.title) = lower(m.target) and matched_item.user_id = p_user_id
  where matched_note.id is not null or matched_item.id is not null;
end;
$$;

-- ─── connect_source ────────────────────────────────────────────
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

-- ─── import_remote_series ──────────────────────────────────────
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
set search_path = public
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

  insert into series (user_id, title, kind)
  values (v_user_id, p_title, 'manga')
  returning id into v_series_id;

  for v_chapter in select * from jsonb_array_elements(p_chapters)
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
      p_cover_url, coalesce((v_chapter->>'pageCount', '')::int, 0),
      'processing', 'remote', p_source_id, p_remote_id,
      v_chapter->>'id', p_cover_url
    )
    returning id into v_item_id;

    v_item_ids := v_item_ids || jsonb_build_array(v_item_id);
  end loop;

  insert into jobs (user_id, item_id, stage, status)
  select v_user_id, x::uuid, 'remote', 'queued'
  from jsonb_array_elements_text(v_item_ids) as x;

  return jsonb_build_object('seriesId', v_series_id, 'itemIds', v_item_ids);
end;
$$;

-- ─── save_progress ─────────────────────────────────────────────
-- `max_page_read` is the spoiler guard: it says "you have read up to
-- page N". It must therefore be monotonic. A plain upsert from the
-- client would happily lower it (the reader clamps against its own
-- local ref, which starts from the *current* page rather than the
-- saved maximum), which would silently revoke pages the user has
-- already read — and would move the guard.
--
-- The upsert below takes the greater of the stored and the incoming
-- value, keeps `finished` sticky, and recomputes `percent` from the
-- item's real page count (it was previously never written at all, so
-- every progress bar rendered 0%).
--
-- SECURITY INVOKER on purpose: Row Level Security still applies.
create or replace function save_progress(
  p_item_id uuid,
  p_page int,
  p_max_page_read int default null,
  p_finished boolean default false
)
returns progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row progress;
  v_pages int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(i.page_count, 0) into v_pages
  from items i where i.id = p_item_id;

  insert into progress (
    user_id, item_id, current_page, max_page_read, percent, finished, updated_at
  )
  values (
    v_user_id,
    p_item_id,
    greatest(0, coalesce(p_page, 0)),
    greatest(0, coalesce(p_max_page_read, p_page, 0)),
    case when v_pages > 0
         then least(100, round(greatest(0, coalesce(p_page, 0))::numeric * 100 / v_pages, 1))
         else 0 end,
    coalesce(p_finished, false),
    now()
  )
  on conflict (user_id, item_id) do update
    set current_page  = excluded.current_page,
        max_page_read = greatest(progress.max_page_read, excluded.max_page_read),
        percent       = excluded.percent,
        finished      = progress.finished or excluded.finished,
        updated_at    = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- ─── save_note ─────────────────────────────────────────────────
-- Notes are edited in the browser and can be open in two tabs at
-- once. A blind update is last-write-wins, which silently throws
-- away whichever edit the browser happened to lose the race with.
--
-- `p_base_updated_at` is the version the editor last read. When the
-- stored row has moved on, the function returns the server's copy
-- with `conflict = true` and writes nothing, so the client can offer
-- "keep mine / keep theirs / merge".
--
-- `updated_at` is nudged forward by at least a millisecond so two
-- saves in the same millisecond still produce different versions.
--
-- SECURITY INVOKER on purpose: Row Level Security still applies, so
-- this can only ever touch the caller's own notes.
create or replace function save_note(
  p_id uuid default null,
  p_title text default 'Untitled',
  p_body_md text default '',
  p_item_id uuid default null,
  p_page_ref int default null,
  p_base_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing notes;
  v_row notes;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_id is not null then
    select * into v_existing
    from notes
    where id = p_id and user_id = v_user_id;

    if v_existing.id is null then
      raise exception 'note not found';
    end if;

    if p_base_updated_at is not null
       and v_existing.updated_at is distinct from p_base_updated_at then
      return jsonb_build_object(
        'conflict', true,
        'note', to_jsonb(v_existing)
      );
    end if;
  end if;

  insert into notes (
    id, user_id, title, body_md, item_id, page_ref, created_at, updated_at
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    v_user_id,
    coalesce(nullif(p_title, ''), 'Untitled'),
    coalesce(p_body_md, ''),
    p_item_id,
    p_page_ref,
    now(),
    now()
  )
  on conflict (id) do update
    set title     = excluded.title,
        body_md   = excluded.body_md,
        item_id   = excluded.item_id,
        page_ref  = excluded.page_ref,
        updated_at = greatest(now(), notes.updated_at + interval '1 millisecond')
  returning * into v_row;

  return jsonb_build_object('conflict', false, 'note', to_jsonb(v_row));
end;
$$;

-- ─── items.speaker_notes ──────────────────────────────────────
-- Speaker notes from a PPTX. They are not part of the rendered
-- slides, so they were being thrown away.
alter table items add column if not exists speaker_notes text;

-- ─── cards.learning_steps ─────────────────────────────────────
-- ts-fsrs v5 tracks *where* in the learning ladder a card is. The
-- application was hard-coding it to 0 on every read, which meant a
-- card in the learning phase always restarted at the first step and
-- could never graduate properly.
--
-- `learning_steps` is only meaningful while `state` is Learning or
-- Relearning (1 or 3); ts-fsrs resets it to 0 on its own when a card
-- graduates to Review.
alter table cards add column if not exists learning_steps int not null default 0;

-- ─── Activity roll-up triggers ─────────────────────────────────
-- The original `bump_activity` read `old.max_page_read` on INSERT,
-- where OLD is not assigned. Postgres raises "record old is not
-- assigned yet", so the *first* progress write for every item failed
-- and the whole upsert rolled back. The trigger now branches on TG_OP.
--
-- Reviews and notes were never rolled up at all, so the heatmap and
-- the "reviews today" tile were permanently empty.
create or replace function bump_activity()
returns trigger language plpgsql as $$
declare
  v_delta int;
begin
  if tg_op = 'INSERT' then
    v_delta := greatest(0, new.max_page_read);
  else
    v_delta := greatest(0, new.max_page_read - coalesce(old.max_page_read, 0));
  end if;

  insert into daily_activity (user_id, date, pages)
  values (new.user_id, current_date, v_delta)
  on conflict (user_id, date)
  do update set pages = daily_activity.pages + excluded.pages;
  return new;
end $$;

drop trigger if exists progress_activity_trigger on progress;
create trigger progress_activity_trigger
  after insert or update of max_page_read on progress
  for each row execute function bump_activity();

create or replace function bump_reviews()
returns trigger language plpgsql as $$
begin
  insert into daily_activity (user_id, date, reviews)
  values (new.user_id, current_date, 1)
  on conflict (user_id, date)
  do update set reviews = daily_activity.reviews + 1;
  return new;
end $$;

drop trigger if exists reviews_activity_trigger on reviews;
create trigger reviews_activity_trigger
  after insert on reviews
  for each row execute function bump_reviews();

create or replace function bump_notes()
returns trigger language plpgsql as $$
begin
  insert into daily_activity (user_id, date, notes)
  values (new.user_id, current_date, 1)
  on conflict (user_id, date)
  do update set notes = daily_activity.notes + 1;
  return new;
end $$;

drop trigger if exists notes_activity_trigger on notes;
create trigger notes_activity_trigger
  after insert on notes
  for each row execute function bump_notes();

-- ═══════════════════════════════════════════════════════════════
-- Execute permissions.
--
-- By default PostgREST exposes every function to `anon` as well as
-- `authenticated`. These functions read a signed-in user's private
-- content, so `anon` must not be able to call them at all, and the
-- service role keeps its access.
-- ═══════════════════════════════════════════════════════════════

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
    execute format('grant execute on function %s to authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
