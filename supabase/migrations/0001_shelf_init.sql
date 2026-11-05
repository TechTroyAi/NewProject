-- ═══════════════════════════════════════════════════════════════
-- Shelf — initial schema
-- Postgres + pgvector + pg_trgm, with Row Level Security on
-- every table. Users come from Supabase auth.users.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ─── Profiles ──────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── Series ────────────────────────────────────────────────────
create table if not exists series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  cover_path text,
  kind text not null default 'mixed' check (kind in ('manga','course','book','mixed')),
  created_at timestamptz not null default now()
);
create index if not exists series_user_idx on series(user_id);

-- ─── Items ─────────────────────────────────────────────────────
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  series_id uuid references series(id) on delete set null,
  type text not null,
  title text not null,
  volume numeric,
  chapter numeric,
  file_hash text not null,
  original_path text not null,
  cover_path text,
  page_count int not null default 0,
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','ready','needs_review','failed')),
  status_detail text,
  ai_summary text,
  ai_tags text[] not null default '{}',
  key_terms jsonb not null default '[]'::jsonb,
  speaker_notes text,
  created_at timestamptz not null default now(),
  unique (user_id, file_hash)
);
create index if not exists items_user_idx on items(user_id);
create index if not exists items_series_idx on items(series_id);
create index if not exists items_title_trgm on items using gin (title gin_trgm_ops);

-- ─── Pages ─────────────────────────────────────────────────────
create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  idx int not null,
  image_path text,
  width int,
  height int,
  text text,
  speaker_notes text,
  unique (item_id, idx)
);
create index if not exists pages_item_idx on pages(item_id, idx);

-- ─── Chunks (AI + semantic search) ─────────────────────────────
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  page_start int not null,
  page_end int not null,
  content text not null,
  embedding vector(1536)
);
create index if not exists chunks_item_idx on chunks(item_id);
create index if not exists chunks_user_idx on chunks(user_id);
create index if not exists chunks_hnsw on chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_fts on chunks using gin (to_tsvector('english', content));

-- ─── Progress ──────────────────────────────────────────────────
create table if not exists progress (
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  current_page int not null default 0,
  max_page_read int not null default 0,
  percent numeric not null default 0,
  finished boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ─── Notes ─────────────────────────────────────────────────────
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body_md text not null default '',
  item_id uuid references items(id) on delete set null,
  page_ref int,
  is_ai_draft boolean not null default false,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on notes(user_id, updated_at desc);
create index if not exists notes_title_trgm on notes using gin (title gin_trgm_ops);
create index if not exists notes_hnsw on notes using hnsw (embedding vector_cosine_ops);

-- ─── Links (wikilinks + AI suggestions) ────────────────────────
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  from_note uuid references notes(id) on delete cascade,
  to_note uuid references notes(id) on delete cascade,
  to_item uuid references items(id) on delete cascade,
  to_page int,
  kind text not null default 'wikilink' check (kind in ('wikilink','ai_suggested','mention')),
  created_at timestamptz not null default now()
);
create index if not exists links_from_idx on links(from_note);
create index if not exists links_to_note_idx on links(to_note);
create index if not exists links_to_item_idx on links(to_item);
create index if not exists links_user_idx on links(user_id);

-- ─── Clips & highlights ────────────────────────────────────────
create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  page_idx int not null,
  bbox jsonb not null,
  image_path text,
  note_id uuid references notes(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists clips_item_idx on clips(item_id, page_idx);

create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  page_idx int not null,
  text text,
  rects jsonb,
  color text not null default 'yellow',
  created_at timestamptz not null default now()
);
create index if not exists highlights_item_idx on highlights(item_id, page_idx);

-- ─── Decks & cards ─────────────────────────────────────────────
create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  item_id uuid references items(id) on delete cascade,
  note_id uuid references notes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  deck_id uuid references decks(id) on delete cascade,
  source_note uuid references notes(id) on delete set null,
  source_item uuid references items(id) on delete set null,
  source_page int,
  spoiler_limit_page int not null default 0,
  type text not null check (type in ('flashcard','mcq','cloze','tf','short','clip','order','match')),
  question text not null,
  answer text not null,
  options jsonb,
  explanation text,
  status text not null default 'active' check (status in ('active','suspended','flagged')),
  due timestamptz not null default now(),
  stability real not null default 0,
  difficulty real not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  state smallint not null default 0,
  last_review timestamptz
);
create index if not exists cards_due_idx on cards(user_id, due) where status = 'active';
create index if not exists cards_deck_idx on cards(deck_id);
create index if not exists cards_source_idx on cards(source_note, source_item);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  ms_taken int,
  reviewed_at timestamptz not null default now()
);
create index if not exists reviews_user_idx on reviews(user_id, reviewed_at desc);

-- ─── Tags & collections ────────────────────────────────────────
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  color text,
  unique (user_id, name)
);

create table if not exists item_tags (
  item_id uuid not null references items(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (item_id, tag_id)
);

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  sort int not null default 0
);

create table if not exists collection_items (
  collection_id uuid not null references collections(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  primary key (collection_id, item_id)
);

-- ─── Jobs, usage, activity ─────────────────────────────────────
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid references items(id) on delete cascade,
  stage text not null,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  progress int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_user_idx on jobs(user_id, created_at desc);

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on ai_usage(user_id, created_at desc);

create table if not exists daily_activity (
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  pages int not null default 0,
  reviews int not null default 0,
  notes int not null default 0,
  primary key (user_id, date)
);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security
-- The policy on every table is the same: you can only ever see
-- and mutate your own rows.
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','series','items','pages','chunks','progress','notes','links',
    'clips','highlights','decks','cards','reviews','tags','item_tags',
    'collections','collection_items','jobs','ai_usage','daily_activity'
  ]
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy "own profile" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own series" on series for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own items" on items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own pages" on pages for all
  using (exists (select 1 from items i where i.id = pages.item_id and i.user_id = auth.uid()))
  with check (exists (select 1 from items i where i.id = pages.item_id and i.user_id = auth.uid()));

create policy "own chunks" on chunks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own progress" on progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own notes" on notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own links" on links for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own clips" on clips for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own highlights" on highlights for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own decks" on decks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own cards" on cards for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own reviews" on reviews for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own tags" on tags for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own item_tags" on item_tags for all
  using (exists (select 1 from items i where i.id = item_tags.item_id and i.user_id = auth.uid()))
  with check (exists (select 1 from items i where i.id = item_tags.item_id and i.user_id = auth.uid()));

create policy "own collections" on collections for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own collection_items" on collection_items for all
  using (exists (select 1 from collections c where c.id = collection_items.collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from collections c where c.id = collection_items.collection_id and c.user_id = auth.uid()));

create policy "own jobs" on jobs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own ai_usage" on ai_usage for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own daily_activity" on daily_activity for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- The spoiler guard.
--
-- retrieve_guarded() is the only path the AI uses to read user
-- content. It refuses to return any chunk that extends past the
-- page the user has actually read. This is enforced by the WHERE
-- clause, so unread content never reaches the model.
-- ═══════════════════════════════════════════════════════════════

-- The user is taken from the JWT, never from a parameter: this
-- function is SECURITY DEFINER, so a parameter would let any caller
-- read another user's content — including pages they have not read
-- yet, which would defeat the spoiler guard entirely.
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
      -- A chunk is only visible if the user has read past its last page.
      and c.page_end <= coalesce(pr.max_page_read, 0)
      -- ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲
  )
  select
    e.content,
    e.item_id,
    e.item_title,
    e.page_start,
    e.page_end,
    -- keyword relevance within the eligible window
    ts_rank(
      to_tsvector('english', e.content),
      plainto_tsquery('english', coalesce(nullif(p_query, ''), 'the'))
    )::double precision as score
  from eligible e
  order by score desc, e.page_start
  limit greatest(1, least(p_limit, 50));
$$;

-- The embedding-aware variant. Kept separate so the guard predicate
-- lives in exactly one place (see above) and is reused here.
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
    -- ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲
  order by c.embedding <=> p_query_embedding
  limit greatest(1, least(p_limit, 50));
$$;

-- Notes are the user's own writing — always in scope.
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

-- Hybrid search across items, notes and pages, merged with
-- Reciprocal Rank Fusion.
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
    -- Without a query embedding the cosine distance is NULL for every
    -- row, and the CTE would contribute 50 arbitrary items to the
    -- fused ranking.
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

-- Bump a note's updated_at and re-index its links after an edit.
-- SECURITY INVOKER on purpose: RLS then decides which links this
-- call may touch. As DEFINER it would have been able to rewrite
-- another user's link index.
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

-- Trigger: keep links fresh whenever a note body changes.
create or replace function note_links_trigger()
returns trigger language plpgsql as $$
begin
  perform reindex_note_links(new.id, new.user_id);
  return new;
end $$;

drop trigger if exists notes_link_trigger on notes;
create trigger notes_link_trigger
  after insert or update of body_md on notes
  for each row execute function note_links_trigger();

-- Roll up daily activity when progress moves.
--
-- `OLD` is not assigned for an INSERT, and referencing `old.max_page_read`
-- there raises "record old is not assigned yet" — which aborted the very
-- first progress write for every item. Branch on TG_OP instead.
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

-- Reviews roll up into the same daily table.
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

-- …and so do new notes.
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
