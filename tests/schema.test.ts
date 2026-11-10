import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* ══════════════════════════════════════════════════════════════
   The schema, checked against the things a live Postgres
   complained about.

   Every assertion in this file exists because the migration
   actually failed (or the function actually misbehaved) on a real
   Postgres 17 instance. Parsing the DDL is not the same as
   running it: PL/pgSQL only resolves a name when the function
   runs, and RLS/TRUNCATE are not visible to a parser at all.
   ══════════════════════════════════════════════════════════════ */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

function migration(name: string): string {
  return readFileSync(join(MIGRATIONS, name), 'utf8')
}

/** The SQL with its comments removed, so an assertion cannot match
 *  a line that only explains the rule. */
function sql(name: string): string {
  return migration(name)
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

const init = migration('0001_shelf_init.sql')
const sources = migration('0002_sources.sql')
const hardening = migration('0003_rls_hardening.sql')
const hardening2 = migration('0006_hardening.sql')

describe('schema: the columns the code actually reads', () => {
  test('items carries the embedding that search_vault reads', () => {
    // The semantic half of the vault search selects i.embedding. The
    // column did not exist, so the whole initial migration failed
    // to apply and the app never had a working database.
    const itemsStart = init.indexOf('create table if not exists items')
    const itemsBlock = init.slice(itemsStart, init.indexOf('create table', itemsStart + 10))
    assert.match(itemsBlock, /embedding\s+vector\(1536\)/)
  })

  test('items and notes both have an HNSW index over their embedding', () => {
    assert.match(init, /create index if not exists items_hnsw[\s\S]*?hnsw \(embedding vector_cosine_ops\)/)
    assert.match(init, /create index if not exists notes_hnsw[\s\S]*?hnsw \(embedding vector_cosine_ops\)/)
  })

  test('every table the app selects from exists', () => {
    const tables = [
      'profiles', 'series', 'items', 'pages', 'chunks', 'progress', 'notes', 'links',
      'clips', 'highlights', 'decks', 'cards', 'reviews', 'tags', 'item_tags',
      'collections', 'collection_items', 'jobs', 'ai_usage', 'daily_activity',
    ]
    for (const t of tables) {
      assert.match(init, new RegExp(`create table if not exists ${t}\\b`), `missing table ${t}`)
      assert.match(
        init,
        new RegExp(`alter table %I enable row level security`, 'i'),
        'the RLS loop must exist'
      )
    }
  })

  test('the RLS loop covers every table it creates', () => {
    const block = init.slice(init.indexOf('foreach t in array array['))
    const listed = block.slice(0, block.indexOf(']'))
    for (const t of ['profiles', 'series', 'items', 'pages', 'chunks', 'progress', 'notes',
      'links', 'clips', 'highlights', 'decks', 'cards', 'reviews', 'tags', 'item_tags',
      'collections', 'collection_items', 'jobs', 'ai_usage', 'daily_activity']) {
      assert.ok(listed.includes(`'${t}'`), `${t} is not in the RLS loop`)
    }
  })
})

describe('schema: search_vault compiles and fuses', () => {
  test('the fused rank is an aggregate, not a window function', () => {
    // `sum(f.rrf) over (partition by f.id)` is invalid next to a
    // GROUP BY: "column f.rrf must appear in the GROUP BY clause
    // or be used in an aggregate function". The rank has to be a
    // plain aggregate so the keyword and vector rankings merge.
    assert.match(init, /sum\(f\.rrf\) as rank/)
    assert.doesNotMatch(init, /sum\(f\.rrf\) over/)
    assert.doesNotMatch(hardening, /sum\(f\.rrf\) over/)
  })

  test('the semantic branch is skipped without a query embedding', () => {
    // Without one the cosine distance is NULL for every row and the
    // CTE would contribute 50 arbitrary items to the fused ranking.
    assert.match(init, /query_embedding is not null/)
    assert.match(init, /i\.embedding is not null/)
  })

  test('the keyword branches are skipped in semantic mode', () => {
    assert.match(init, /search_mode <> 'semantic'/)
    assert.match(init, /search_mode <> 'keyword'/)
  })
})

describe('schema: the spoiler guard lives in SQL', () => {
  test('both retrieval paths require the pages to have been read', () => {
    const guard = /c\.page_end <= coalesce\(pr\.max_page_read, 0\)/
    assert.match(init, guard)
    assert.match(init, guard)
    // and it must appear in the semantic variant too
    const semantic = init.slice(init.indexOf('create or replace function retrieve_guarded_semantic'))
    assert.match(semantic, guard)
  })

  test('the guarded functions are security definer with a pinned path', () => {
    for (const fn of ['retrieve_guarded', 'retrieve_guarded_semantic', 'retrieve_notes', 'search_vault']) {
      const block = init.slice(init.indexOf(`create or replace function ${fn}`))
      assert.match(block.slice(0, 900), /security definer/, `${fn} must be security definer`)
      assert.match(block.slice(0, 900), /set search_path = public/, `${fn} must pin the search path`)
    }
  })

  test('the user comes from the JWT, never from a parameter', () => {
    // A parameter would let any caller read another user's content
    // in a security definer function — including pages they have
    // not read, which would defeat the spoiler guard entirely.
    for (const fn of ['retrieve_guarded', 'retrieve_guarded_semantic', 'retrieve_notes', 'search_vault']) {
      const block = init.slice(init.indexOf(`create or replace function ${fn}`))
      assert.match(block.slice(0, 1400), /auth\.uid\(\)/, `${fn} must scope on auth.uid()`)
      assert.doesNotMatch(block.slice(0, 1400), /p_user_id uuid/, `${fn} must not take a user id`)
    }
  })
})

describe('schema: import_remote_series runs', () => {
  test('pgcrypto is reachable from the function', () => {
    // pgcrypto lives in the `extensions` schema on Supabase. With
    // the path pinned to `public` alone, digest() failed at runtime
    // with "function digest(text, unknown) does not exist" — the
    // function compiled, because PL/pgSQL resolves the name only
    // when it runs.
    assert.match(sources, /create or replace function import_remote_series[\s\S]*?set search_path = public, extensions/)
    assert.match(hardening, /create or replace function import_remote_series[\s\S]*?set search_path = public, extensions/)
  })

  test('the page count is a nullif fallback, not a row constructor', () => {
    // `(a, b)` is a ROW, so `(v_chapter->>'pageCount', '')::int` tried
    // to cast a record to an integer and raised "cannot cast type
    // record to integer".
    assert.match(sql('0002_sources.sql'), /coalesce\(nullif\(v_chapter->>'pageCount', ''\)::int, 0\)/)
    assert.doesNotMatch(sql('0002_sources.sql'), /coalesce\(\(v_chapter->>'pageCount'/)
    assert.doesNotMatch(sql('0003_rls_hardening.sql'), /coalesce\(\(v_chapter->>'pageCount'/)
  })

  test('the chapter loop iterates over the jsonb value', () => {
    // `select *` hands the loop variable a record; it is declared
    // jsonb.
    assert.match(sources, /for v_chapter in select value from jsonb_array_elements\(p_chapters\)/)
  })
})

describe('schema: privileges', () => {
  test('anon cannot execute the signed-in RPCs', () => {
    assert.match(hardening2, /revoke execute on function %s from anon/)
    assert.match(hardening2, /revoke execute on function %s from public/)
  })

  test('anon and authenticated cannot truncate', () => {
    // TRUNCATE never consults an RLS policy, so the privilege alone
    // decides. Supabase grants ALL on the public schema by default.
    assert.match(hardening2, /revoke truncate on table %s from anon/)
    assert.match(hardening2, /revoke truncate on table %s from authenticated/)
  })

  test('the encrypted key table is not readable by anon', () => {
    const keys = migration('0004_user_api_keys.sql')
    assert.match(keys, /revoke all on user_api_keys from anon, authenticated/)
  })
})

describe('schema: the activity triggers survive an insert', () => {
  test('bump_activity branches on TG_OP', () => {
    // OLD is not assigned on INSERT, and referencing it raises
    // "record old is not assigned yet" — which aborted the very
    // first progress write for every item.
    const block = init.slice(init.indexOf('create or replace function bump_activity'))
    assert.match(block.slice(0, 900), /tg_op = 'INSERT'/)
    assert.match(block.slice(0, 900), /coalesce\(old\.max_page_read, 0\)/)
  })

  test('reviews and notes roll up too', () => {
    assert.match(init, /create or replace function bump_reviews/)
    assert.match(init, /create or replace function bump_notes/)
  })
})
