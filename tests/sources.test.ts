import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalizeCatalog, pickAdapter, languageLabel, CatalogSchema } from '@shelf/shared'
import { parseMadaraSearch } from '@shelf/sources'
import { sniffImageType, descriptorFromRow } from '../apps/worker/src/stages/remote.js'

import snapshot from '../packages/sources/src/catalog-snapshot.json' with { type: 'json' }

/* ══════════════════════════════════════════════════════════════
   Public source catalogue.

   Shelf reads the Mihon/Tachiyomi extension index from the public
   keiyoushi/extensions repository. These tests pin the contract
   between that catalogue and the adapters that fetch from it.
   ══════════════════════════════════════════════════════════════ */

const catalog = CatalogSchema.parse(snapshot)
const sources = normalizeCatalog(catalog)

test('bundled catalogue parses and matches the published shape', () => {
  assert.equal(catalog.repo, 'keiyoushi/extensions')
  assert.equal(catalog.branch, 'repo')
  assert.ok(catalog.extensions.length > 1000, 'expected the full extension list')
  assert.ok(catalog.extensions.length < 3000, 'catalogue looks implausibly large')
})

test('catalogue flattens into one descriptor per extension-language pair', () => {
  const expected = catalog.extensions.reduce((n, e) => n + e.sources.length, 0)
  assert.equal(sources.length, expected)
  assert.ok(sources.length > 2000, 'expected thousands of language-specific sources')

  // Keys are unique and stable.
  const keys = new Set(sources.map((s) => s.key))
  assert.equal(keys.size, sources.length)
  for (const s of sources) {
    assert.ok(s.key.includes('#'), `key should embed the catalog id: ${s.key}`)
  }
})

test('catalogue covers many languages, English included', () => {
  const langs = new Set(sources.map((s) => s.language))
  assert.ok(langs.size >= 50, `expected 50+ languages, got ${langs.size}`)
  assert.ok(langs.has('en'))
  assert.ok(langs.has('ja'))
  assert.ok(langs.has('all'))
})

test('every descriptor carries an icon path inside the extensions-source repo', () => {
  const withIcon = sources.filter((s) => s.iconPath)
  assert.ok(withIcon.length / sources.length > 0.99, 'nearly every source should have an icon')
  for (const s of withIcon.slice(0, 50)) {
    assert.match(s.iconPath!, /^src\/[a-z-]+\/[a-z0-9_-]+\/res\/mipmap-[a-z0-9]+\/ic_launcher\.png$/)
  }
})

test('MangaDex is routed to the MangaDex adapter', () => {
  const mdx = sources.filter((s) => s.extensionName === 'MangaDex')
  assert.ok(mdx.length > 20, 'MangaDex exposes many language sources')
  for (const s of mdx) assert.equal(s.adapter, 'mangadex')

  const en = mdx.find((s) => s.language === 'en')!
  assert.equal(en.homeUrl, 'https://mangadex.org')
  assert.ok(en.catalogId.length > 5)
})

test('other sources fall back to the generic adapter when they expose a home url', () => {
  assert.equal(pickAdapter('eu.kanade.tachiyomi.extension.all.mangadex', 'MangaDex', null), 'mangadex')
  assert.equal(pickAdapter('eu.kanade.tachiyomi.extension.en.something', 'Something', 'https://x.tld'), 'madara')
  assert.equal(pickAdapter('eu.kanade.tachiyomi.extension.en.other', 'Other', null), null)
})

test('language labels resolve, with a fallback for unknown codes', () => {
  assert.equal(languageLabel('en'), 'English')
  assert.equal(languageLabel('pt-BR'), 'Portuguese (BR)')
  assert.equal(languageLabel('all'), 'All languages')
  assert.ok(languageLabel('xx-YY').length > 0)
})

/* ─── Madara HTML parsing ─────────────────────────────────────── */

const MADARA_HTML = `
<html><body>
  <div class="c-tabs-item__content">
    <div class="d-lg-flex">
      <div class="item-summary">
        <div class="summary_image">
          <a href="https://example.test/manga/one-piece/" class="permalink">
            <div class="image">
              <img data-src="https://cdn.example.test/cover/one-piece.jpg" alt="One Piece"/>
            </div>
            <h3 class="post-title">One Piece</h3>
          </a>
        </div>
      </div>
    </div>
  </div>
  <div class="c-tabs-item__content">
    <div class="d-lg-flex">
      <div class="item-summary">
        <div class="summary_image">
          <a href="https://example.test/manga/berserk/" class="permalink">
            <div class="image">
              <img src="https://cdn.example.test/cover/berserk.webp" alt="Berserk"/>
            </div>
            <h3 class="post-title">Berserk</h3>
          </a>
        </div>
      </div>
    </div>
  </div>
</body></html>
`

test('Madara search results yield title, slug and absolute cover', () => {
  const results = parseMadaraSearch(MADARA_HTML, 'https://example.test')
  assert.equal(results.length, 2)

  assert.equal(results[0].id, 'one-piece')
  assert.equal(results[0].title, 'One Piece')
  assert.equal(results[0].coverUrl, 'https://cdn.example.test/cover/one-piece.jpg')

  assert.equal(results[1].id, 'berserk')
  assert.equal(results[1].title, 'Berserk')
  assert.equal(results[1].coverUrl, 'https://cdn.example.test/cover/berserk.webp')
})

test('Madara parsing ignores non-manga links and duplicates', () => {
  const html = `<div class="c-tabs-item__content">
      <a href="https://example.test/manga/dupe/">x</a>
      <a href="https://example.test/manga/dupe/">y</a>
      <a href="https://example.test/novel/other/">z</a>
    </div>`
  const results = parseMadaraSearch(html, 'https://example.test')
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'dupe')
})

/* ─── Remote stage helpers ────────────────────────────────────── */

test('remote image sniffing accepts common formats and rejects everything else', () => {
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg')
  assert.equal(
    sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
    'image/png',
  )
  assert.equal(sniffImageType(Buffer.from('RIFF____WEBPmore', 'ascii')), 'image/webp')
  assert.equal(sniffImageType(Buffer.from('GIF89a________', 'ascii')), 'image/gif')
  assert.equal(sniffImageType(Buffer.from('<!DOCTYPE html><html>', 'ascii')), null)
  assert.equal(sniffImageType(Buffer.alloc(4)), null)
})

test('a connected source row round-trips into a descriptor', () => {
  const desc = descriptorFromRow({
    source_key: 'eu.kanade.tachiyomi.extension.all.mangadex#2499283573021220255',
    package_name: 'eu.kanade.tachiyomi.extension.all.mangadex',
    catalog_id: '2499283573021220255',
    name: 'MangaDex',
    language: 'en',
    home_url: 'https://mangadex.org',
    icon_path: 'src/all/mangadex/res/mipmap-xhdpi/ic_launcher.png',
    adapter: 'mangadex',
    nsfw: false,
  })
  assert.equal(desc.key, 'eu.kanade.tachiyomi.extension.all.mangadex#2499283573021220255')
  assert.equal(desc.adapter, 'mangadex')
  assert.equal(descriptorFromRow({ ...desc, adapter: 'mangadex' } as any).language, 'en')
})
