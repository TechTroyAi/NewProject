# Shelf

**Drop anything. Read it. Think about it. Remember it.**

A reading shelf that combines three things that usually live apart:

- **A library & reader** (Mihon) — CBZ, PDF, PPTX, DOCX, EPUB in, a fast paginated reader out, with progress that survives a closed tab.
- **A markdown vault with backlinks** (Obsidian) — `[[wikilinks]]` that resolve from a note straight into a *page* of a *chapter*: `[[Berserk#Ch341 p9]]` → `/app/read/<id>?p=9`.
- **An assistant that cannot spoil you** — retrieval is filtered by your reading progress **in SQL**, so unread pages never reach the model. It can't leak them because it never receives them.

Plus spaced repetition (FSRS) generated from your own notes, and one graph where notes, series and chapters are all first-class nodes.

```
┌─ browser ────────────┐      ┌─ next.js server ─────────┐     ┌─ infra ────────────┐
│ React · Tailwind     │      │ auth · CRUD · streaming  │     │ Supabase (pgvector)│
│ Web Workers          │─────▶│ AI endpoints · jobs      │────▶│ R2 / S3 storage    │
│ IndexedDB · SW (PWA) │      │ signed upload URLs       │     │ Inngest / BullMQ   │
└──────────────────────┘      └──────────────────────────┘     └─────────┬──────────┘
                                                                          ▼
                                                            ┌─ worker (Docker) ───────┐
                                                            │ LibreOffice · Tesseract │
                                                            │ poppler · sharp · AI    │
                                                            └──────────────────────────┘
```

---

## Run it now (no infra needed)

The app boots with **zero configuration** and runs on a seeded demo shelf — real UI, real interactions, deterministic mock AI.

```bash
npm install
npm run dev          # → http://localhost:3000
```

Then open:

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/login`, `/signup` | Credentials (Supabase auth; demo mode explains itself) |
| `/app` | Dashboard — continue reading, recent notes, graph preview, assistant picks |
| `/app/library` | Library grid, grouped by series |
| `/app/library/[seriesId]` | Series page with chapter list |
| `/app/item/[itemId]` | Item detail — AI summary, key terms, linked notes, page map |
| `/app/read/[itemId]?p=14` | Reader (long-strip or paged, RTL, keyboard, progress saving) |
| `/app/notes` | Notes list |
| `/app/notes/[noteId]` | Markdown editor, wikilink autocomplete, live preview, backlinks |
| `/app/quiz` | Decks + due count |
| `/app/quiz/session` | Active session (FSRS scheduling, keyboard `1`–`4`) |
| `/app/graph` | Force-directed graph, 5 node types |
| `/app/inbox` | Needs-review queue |
| `/app/sources` | Public source catalogue (Mihon/Keiyoushi), connect a source |
| `/app/sources/[key]` | Browse a connected source, import chapters |
| `/app/stats` | Heatmap, weak spots |
| `/app/settings/[section]` | general · reader · ai · quiz · data · shortcuts |

**Useful bits to try**

- `⌘K` → command palette (hybrid search + `>` commands)
- `[[` in a note → wikilink autocomplete
- Click any `[[...]]` → jumps into the reader at the exact page
- Open the assistant → ask *"compare the two smiles"* and watch it refuse to go past your progress
- Toggle theme (paper / midnight / amoled) and accent colour from the top bar

---

## Wire it to a real database

Shelf runs in **demo mode** until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. Then it switches to live Postgres automatically — no code changes.

```bash
cp .env.example .env.local
```

The `.env` lives at the **repository root** — the web app, the worker
and the CLI all read the same file (Next.js only looks inside
`apps/web`, so the root file is loaded explicitly). Anything already
set in the real environment wins over the file, so a deployed
environment always takes precedence.

### 1. Database

```bash
supabase link --project-ref <your-ref>
supabase db push          # applies supabase/migrations/0001_shelf_init.sql
```

That migration creates every table, enables **Row Level Security on all of them**, and installs the functions that matter:

| Function | Purpose |
|---|---|
| `retrieve_guarded(user, items, …)` | Chunk retrieval **filtered by `progress.max_page_read`**. The spoiler guard lives here. |
| `retrieve_guarded_semantic(…)` | Same guard, vector-ordered. |
| `retrieve_notes(…)` | Your own notes — keyword or vector ranked. |
| `search_vault(…)` | Hybrid search, keyword + pgvector, merged with **Reciprocal Rank Fusion**. |
| `reindex_note_links(note, user)` | Re-parses `[[wikilinks]]` and rewrites the `links` table. |
| `notes_link_trigger` | Fires on every `body_md` change, so backlinks are never stale. |

### 2. Storage

Point `NEXT_PUBLIC_MEDIA_BASE_URL` at your R2/S3 public prefix and implement the presigned PUT in `app/api/upload/init/route.ts` (one function — the client already handles the `uploadUrl` it returns).

### 3. AI

Set `OPENAI_API_KEY` and the assistant switches from the deterministic mock to real streaming. Without a key it still answers, using the demo dataset — so the UI is always explorable.

### 4. Worker

The conversion pipeline runs in a separate container so a 500-page PDF never blocks your site.

```bash
docker build -t shelf-worker apps/worker
docker run --rm --network none --read-only \
  -e NEXT_PUBLIC_SUPABASE_URL=… -e SUPABASE_SERVICE_ROLE_KEY=… \
  -e OPENAI_API_KEY=… \
  shelf-worker
```

Stages, each an independent job so a failure retries only itself:

```
sniff → convert → ocr → chunk → embed → summarize → match
```

The item flips to `ready` right after **convert**, so you can start reading while OCR and the AI pass are still running. Text features light up as the later stages finish.

> **Security note:** run the worker with `--network none --read-only` and drop all Linux capabilities. Office documents are a classic attack vector and LibreOffice is the sharpest edge in this pipeline. The Dockerfile also pins a non-root user and a private LibreOffice profile per job.

---

## Public sources — manga from the Mihon catalogue

Shelf does not ask you to upload a manga you do not own. It reads the
**same extension catalogue Mihon/Tachiyomi uses** — the public
[`keiyoushi/extensions`](https://github.com/keiyoushi/extensions) repository — and
lets you connect any of its sources.

```
keiyoushi/extensions  →  index.json  →  1,454 extensions  →  2,379 language sources
                                                                     ↓
                                              Shelf adapters (MangaDex, Madara, …)
                                                                     ↓
                                        series + items + pages, exactly like an upload
```

* **The catalogue is fetched live** from the public repository through the GitHub
  contents API (the `index.json` blob), cached for six hours, with a bundled
  snapshot as a fallback so the app still works offline. The `Sources` page shows
  the live commit SHA it read.
* **1,454 extensions across 150 languages** are flattened into one descriptor per
  (extension, language) pair — 2,379 connectable sources in total.
* **Extension icons are proxied** through `/api/sources/icon`, so the browser never
  depends on a third-party CDN.
* **Adapters do the fetching.** A Mihon extension is Kotlin; a web app can only
  talk to sources that expose an HTTP API, so adapters are added one provider at a
  time. Two ship today:
  * `mangadex` — the full MangaDex REST API (search, chapters, page images).
  * `madara` — a generic adapter for the Madara WordPress theme behind a large
    share of the catalogue, probed at runtime.
  Sources without an adapter still appear in the catalogue and can be connected —
  they are marked *metadata only* until an adapter lands.
* **Importing produces normal shelf items.** A remote manga becomes a `series`
  plus one `item` per chapter, so the reader, progress tracking, notes, wikilinks,
  quizzes and the graph all work unchanged. The worker downloads the chapter pages
  into storage in the `remote` stage and flips the item to `ready`.
* **It degrades, it does not break.** If a source is unreachable the API answers
  with an offline sample catalogue and says so, rather than failing the page.

| Route | What it does |
| --- | --- |
| `GET /api/sources` | The catalogue: extensions, languages, adapter support, connected state |
| `GET /api/sources/icon?path=…` | Extension icon, proxied via the GitHub API |
| `GET /api/sources/browse?source=…&q=…` | Search a connected source |
| `GET /api/sources/chapters?source=…&mangaId=…` | Chapters for a manga |
| `POST /api/sources/connect` | Connect / disconnect a source |
| `POST /api/sources/import` | Import a manga as a series + items |

Database: `supabase/migrations/0002_sources.sql` adds the `sources` table, the
`items.origin / source_id / remote_id / remote_chapter_id` columns, and the
`connect_source` / `import_remote_series` RPCs.

## AI providers — bring your own key

Shelf does not want to pay your AI bill, and it does not want your
content leaving the machine unless you say so. The first provider
with a key wins:

```
Gemini  ->  OpenAI  ->  Anthropic  ->  Ollama
```

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio. New *Auth keys* start with `AQ.` (the legacy format was `AIza…`); they are sent in the `x-goog-api-key` header, which Shelf does for you. |
| `GEMINI_MODEL` | Defaults to `gemini-3.8-flash`. If Google retires the id, Shelf falls through to the next candidate automatically. |
| `OPENAI_API_KEY` | `gpt-4o-mini` by default. |
| `ANTHROPIC_API_KEY` | `claude-3-5-haiku-latest` by default. Anthropic serves no embeddings, so the embedding provider stays separate. |
| `OLLAMA_BASE_URL` | Point at a local Ollama server for a fully offline setup. |
| `SHELF_ENCRYPTION_KEY` | 32 bytes, hex or base64. Encrypts the keys a user brings their own — see below. |

### Bring your own key

A user can store their own provider key in **Settings → AI**. It is
sealed with AES-256-GCM (`SHELF_ENCRYPTION_KEY`) before it is written,
never sent back to the browser, and never logged; only a short
fingerprint comes back so the user can tell which key is in use. The
server-level key stays as the fallback, so nothing breaks if the
encryption key is not configured — the feature is simply switched off
and the UI says so.

With no key at all, Shelf falls back to its deterministic offline
model — the chat still cites real sources, the quizzes still get
generated, and the spoiler guard still holds. That is what makes the
demo mode fully explorable.

**Embeddings.** Chunks are embedded into 1536 dimensions to match the
`pgvector` column, whichever provider is live: Gemini's
`gemini-embedding-001` (asked for exactly 1536) or OpenAI's
`text-embedding-3-small`. The chat question and the search query are
embedded with the same model, so retrieval is genuinely hybrid —
keyword rank fused with vector distance — and not keyword-only.

**Keys never reach the browser.** The provider is resolved on the
server, and the settings panel only ever shows the provider *name*,
never the key.

## The three ideas worth stealing

### 1. The spoiler guard is SQL, not a prompt

The instinct is to tell the model *"don't spoil me"*. That does not work — a model will leak when asked directly. So the filter happens before the model sees anything:

```sql
and c.page_end <= coalesce(pr.max_page_read, 0)
```

A chunk from an unread page is never serialised into the prompt. The assistant genuinely cannot spoil you, because it never received the material. This is what makes AI + manga legal to combine, and it is the single highest-leverage decision in the codebase.

### 2. Wikilinks that resolve into *pages*

Obsidian's `[[links]]` point at notes. Here they point into a rendered page of a document:

```
[[Griffith]]              → /app/notes/n-griffith
[[Blue Lock]]             → /app/read/i-bl-184
[[Blue Lock#Ch184 p12]]   → /app/read/i-bl-184?p=12     ← note → series → chapter → page
[[Denji's smile]]         → /app/notes/n-makima-smile
```

Resolution order: exact title → series title (disambiguated by the chapter in the anchor) → note-title prefix. Anything left over renders dim, as *"create this note"* — exactly Obsidian's behaviour.

### 3. One graph, five node types

Notes, series, chapters, AI-generated wikis and image nodes share a single graph. The `links` table records `wikilink`, `ai_suggested` and `mention` edges separately, so you can see where the AI *proposed* a connection versus where you made it.

---

## Repo layout

```
.
├─ apps/
│  ├─ web/                      # Next.js 14 · App Router · TS · Tailwind
│  │  ├─ src/app/               # routes + API handlers
│  │  ├─ src/components/        # shell · dashboard · reader · notes · quiz · graph · upload
│  │  ├─ src/lib/               # data access · wikilinks · fsrs · ai · theme · hotkeys
│  │  └─ src/workers/           # streaming SHA-256 in a Web Worker
│  └─ worker/                   # Docker conversion pipeline
│     ├─ src/stages/            # sniff · convert · ocr · chunk · embed · summarize · match
│     └─ Dockerfile
├─ packages/shared/             # zod contracts + wikilink/filename parsing
├─ packages/sources/            # public catalogue reader + provider adapters
└─ supabase/migrations/         # schema + RLS + the spoiler-guard functions
```

## Tech

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router), TS | Server actions + streaming routes in one place |
| UI | Tailwind, hand-rolled primitives, lucide | No component-library lock-in; shadcn-compatible API |
| DB | Supabase — Postgres + pgvector + pg_trgm | One service for auth, relational data and vectors |
| Storage | Cloudflare R2 / S3 / Supabase Storage | Presigned uploads; files never proxy through the app server |
| Jobs | Inngest or BullMQ | Stage-level retries |
| AI | Vercel AI SDK, OpenAI, or Ollama | Provider-agnostic; BYO key supported |
| Scheduling | `ts-fsrs` | FSRS-6, the best-known spaced-repetition algorithm |
| Graph | `d3-force` + custom SVG | Full control over node rendering and hit-testing |

## Security

- **RLS on every table** — `user_id = auth.uid()`, written into the migration, not bolted on later.
- **Signed URLs** with short expiry for every file.
- **Magic-byte file sniffing** — extensions are never trusted; executables are rejected.
- **Zip-bomb guard** — entry count and total decompressed size are capped.
- **Sandboxed worker** — no network, read-only filesystem, non-root, no capabilities.
- **Sanitised markdown** — wikilinks are substituted through opaque placeholders, so no raw HTML reaches the renderer.
- **BYO API keys** encrypted at rest and never logged.
- **No public sharing** of uploaded files, ever. Terms require you only upload what you have the rights to.
- **Outbound fetches are constrained** — remote pages are size-capped and magic-byte
  checked before they are stored, and the catalogue is read from one public repository.

## Deliberate deviations from the original spec

| Spec said | Shelf does | Why |
|---|---|---|
| TipTap editor | Markdown-first editor | `body_md` stays the source of truth, so Obsidian export is trivial and wikilink semantics are exact. The editor is a single component — swapping in TipTap later is a contained change. |
| R2/S3 presigned URLs | Adapter interface | One function to implement; Supabase Storage works unchanged. |
| `daily_activity` rollup table | Present in the schema, computed by trigger | The dashboard reads it directly in live mode and seeds it in demo mode. |

## Roadmap

- [ ] Series auto-matching UI (the Inbox already reasons about candidates)
- [ ] Clip tool — drag a rectangle on a page, crop server-side, insert `![[clip:…]]`
- [ ] Public share links for a note or deck (`/s/[token]`)
- [ ] Offline PWA shell with cached pages for offline reading
- [ ] Service worker for resumable uploads over `tus`

---

Built for one person with a lot of tabs open.

---

<sub>Also in this repo: `prototype/dashboard.html` — the original static design mock, kept as a reference for the visual direction. The live app supersedes it.</sub>
