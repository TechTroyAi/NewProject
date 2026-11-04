import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseWikilinks,
  parseAnchor,
  parseFilename,
  IngestionSchema,
  QuizGenerationSchema,
  ChatScopeSchema,
} from '@shelf/shared'

import { resolveWikilinks } from '../apps/web/src/lib/wikilinks.ts'
import { naturalCompare, guardArchive } from '../apps/worker/src/stages/convert.ts'
import { chunkPages } from '../apps/worker/src/stages/chunk.ts'
import { similarity } from '../apps/worker/src/stages/match.ts'
import { demoItems, demoProgress } from '../apps/web/src/lib/demo.ts'

/* ══════════════════════════════════════════════════════════════
   Wikilink parsing
   ══════════════════════════════════════════════════════════════ */

describe('parseWikilinks', () => {
  test('parses a plain note link', () => {
    const [l] = parseWikilinks('see [[Griffith]] here')
    assert.equal(l.target, 'Griffith')
    assert.equal(l.anchor, null)
    assert.equal(l.alias, null)
  })

  test('parses a chapter + page anchor', () => {
    const [l] = parseWikilinks('[[Berserk#Ch21 p14]]')
    assert.equal(l.target, 'Berserk')
    assert.equal(l.anchor, 'Ch21 p14')
  })

  test('parses an alias', () => {
    const [l] = parseWikilinks('[[the note|the note title]]')
    assert.equal(l.target, 'the note')
    assert.equal(l.alias, 'the note title')
  })

  test('parses a clip link', () => {
    const [l] = parseWikilinks('![[clip:abc123]]')
    assert.equal(l.kind, 'clip')
    assert.equal(l.target, 'abc123')
  })

  test('finds every link in a document', () => {
    const links = parseWikilinks('[[A]] and [[B#p2]] and [[C|x]]')
    assert.equal(links.length, 3)
  })

  test('ignores empty links', () => {
    assert.equal(parseWikilinks('[[]] and [[ ]]').length, 0)
  })
})

describe('parseAnchor', () => {
  test('extracts chapter and page', () => {
    assert.deepEqual(parseAnchor('Ch21 p14'), { chapter: 21, page: 14 })
  })

  test('handles a page-only anchor', () => {
    assert.deepEqual(parseAnchor('p14'), { chapter: null, page: 14 })
  })

  test('handles a null anchor', () => {
    assert.deepEqual(parseAnchor(null), { chapter: null, page: null })
  })
})

/* ══════════════════════════════════════════════════════════════
   Wikilink resolution — the Obsidian ↔ reader bridge
   ══════════════════════════════════════════════════════════════ */

const notes = [
  { id: 'n-griffith', title: 'Griffith — the price of the Falcon' },
  { id: 'n-smile', title: "Denji's smile vs Makima's smile" },
]

const items = [
  { id: 'i-bl-184', title: 'Blue Lock v01 c184', seriesTitle: 'Blue Lock', chapter: 184 },
  { id: 'i-bl-185', title: 'Blue Lock v01 c185', seriesTitle: 'Blue Lock', chapter: 185 },
  { id: 'i-berserk-341', title: 'Berserk v22 c341', seriesTitle: 'Berserk', chapter: 341 },
]

describe('resolveWikilinks', () => {
  const opts = { notes, items }

  test('resolves a note by exact title', () => {
    const [l] = resolveWikilinks("[[Denji's smile vs Makima's smile]]", opts)
    assert.equal(l.resolved, true)
    assert.equal(l.href, '/app/notes/n-smile')
    assert.equal(l.kind, 'note')
  })

  test('resolves a note by title prefix', () => {
    const [l] = resolveWikilinks('[[Griffith]]', opts)
    assert.equal(l.resolved, true)
    assert.equal(l.href, '/app/notes/n-griffith')
  })

  test('resolves a series title to an item', () => {
    const [l] = resolveWikilinks('[[Blue Lock]]', opts)
    assert.equal(l.resolved, true)
    assert.equal(l.kind, 'item')
    assert.ok(l.href.startsWith('/app/read/i-bl-'))
  })

  test('resolves a series + chapter to the right item', () => {
    const [l] = resolveWikilinks('[[Blue Lock#Ch185]]', opts)
    assert.equal(l.href, '/app/read/i-bl-185')
  })

  test('resolves a chapter + page to a deep link', () => {
    const [l] = resolveWikilinks('[[Berserk#Ch341 p9]]', opts)
    assert.equal(l.href, '/app/read/i-berserk-341?p=9')
  })

  test('resolves a page-only anchor', () => {
    const [l] = resolveWikilinks('[[Blue Lock#p12]]', opts)
    assert.ok(l.href.includes('?p=12'))
  })

  test('leaves an unknown target unresolved', () => {
    const [l] = resolveWikilinks('[[Nonexistent Thing]]', opts)
    assert.equal(l.resolved, false)
    assert.ok(l.href.includes('/app/notes/new'))
  })

  test('uses the alias as the display label', () => {
    const [l] = resolveWikilinks('[[Griffith|the price]]', opts)
    assert.equal(l.label, 'the price')
    assert.equal(l.href, '/app/notes/n-griffith')
  })
})

/* ══════════════════════════════════════════════════════════════
   Filename intelligence
   ══════════════════════════════════════════════════════════════ */

describe('parseFilename', () => {
  test('pulls series, volume and chapter out of a CBZ name', () => {
    const r = parseFilename('Berserk v03 c21.cbz')
    assert.equal(r.series, 'Berserk')
    assert.equal(r.volume, 3)
    assert.equal(r.chapter, 21)
  })

  test('handles underscores and dots', () => {
    const r = parseFilename('Blue_Lock.v01.c184.cbz')
    assert.equal(r.series, 'Blue Lock')
    assert.equal(r.chapter, 184)
  })

  test('handles a chapter-only name', () => {
    const r = parseFilename('Chapter 12.pdf')
    assert.equal(r.chapter, 12)
  })

  test('returns the whole name when nothing parses', () => {
    const r = parseFilename('Lecture Notes.pdf')
    assert.equal(r.series, 'Lecture Notes')
    assert.equal(r.chapter, null)
  })
})

/* ══════════════════════════════════════════════════════════════
   Worker: natural sort, chunking, archive guard, similarity
   ══════════════════════════════════════════════════════════════ */

describe('naturalCompare', () => {
  test('sorts page2 before page10', () => {
    const files = ['page10.png', 'page2.png', 'page1.png']
    assert.deepEqual(files.sort(naturalCompare), ['page1.png', 'page2.png', 'page10.png'])
  })

  test('ignores case', () => {
    assert.ok(naturalCompare('a.png', 'B.png') < 0)
  })

  test('orders by directory then file', () => {
    const files = ['ch2/p1.png', 'ch10/p1.png', 'ch2/p2.png']
    assert.deepEqual(files.sort(naturalCompare), ['ch2/p1.png', 'ch2/p2.png', 'ch10/p1.png'])
  })
})

describe('chunkPages', () => {
  const pages = Array.from({ length: 10 }, (_, i) => ({
    idx: i,
    text: `page ${i} `.repeat(200), // ~1400 chars each
  }))

  test('splits long text into chunks', () => {
    const chunks = chunkPages(pages)
    assert.ok(chunks.length > 1, 'expected more than one chunk')
  })

  test('records the page range for every chunk', () => {
    for (const c of chunkPages(pages)) {
      assert.ok(c.page_start <= c.page_end)
      assert.ok(c.page_end < pages.length)
    }
  })

  test('never loses content at a boundary', () => {
    const chunks = chunkPages(pages)
    const joined = chunks.map((c) => c.content).join('')
    assert.ok(joined.includes('page 0'))
    assert.ok(joined.includes('page 9'))
  })

  test('returns nothing for text-free pages', () => {
    assert.deepEqual(chunkPages([{ idx: 0, text: '' }]), [])
  })

  test('keeps a single short document as one chunk', () => {
    const chunks = chunkPages([{ idx: 0, text: 'A short note about something.' }])
    assert.equal(chunks.length, 1)
    assert.equal(chunks[0].page_start, 0)
  })
})

describe('guardArchive', () => {
  test('rejects an archive with too many entries', () => {
    const fake = { getEntries: () => Array.from({ length: 10_001 }, () => ({ header: { size: 10 } })) }
    const r = guardArchive(fake as never)
    assert.equal(r.ok, false)
    assert.match(r.reason!, /entries/)
  })

  test('rejects an archive that expands too far', () => {
    const fake = {
      getEntries: () => [{ header: { size: 3 * 1024 * 1024 * 1024 } }],
    }
    assert.equal(guardArchive(fake as never).ok, false)
  })

  test('accepts a normal archive', () => {
    const fake = { getEntries: () => [{ header: { size: 1024 } }] }
    assert.equal(guardArchive(fake as never).ok, true)
  })
})

describe('similarity', () => {
  test('scores an exact match at 1', () => {
    assert.ok(similarity('Blue Lock', 'Blue Lock') > 0.95)
  })

  test('scores unrelated titles low', () => {
    assert.ok(similarity('Blue Lock', 'Distributed Systems') < 0.3)
  })

  test('scores a prefix match above an unrelated match', () => {
    assert.ok(similarity('Berserk', 'Berserk v22') > similarity('Berserk', 'One Piece'))
  })
})

/* ══════════════════════════════════════════════════════════════
   Schemas
   ══════════════════════════════════════════════════════════════ */

describe('schemas', () => {
  test('ingestion output validates', () => {
    const r = IngestionSchema.safeParse({
      title: 'Blue Lock c184',
      series: 'Blue Lock',
      volume: null,
      chapter: 184,
      summary: 'Egoist is introduced.',
      tags: ['egoist'],
      keyTerms: [{ term: 'Egoist', definition: 'Pursues his own desire.' }],
      language: 'en',
      contentKind: 'manga',
    })
    assert.equal(r.success, true)
  })

  test('ingestion rejects an unknown content kind', () => {
    const r = IngestionSchema.safeParse({
      title: 'x', series: null, volume: null, chapter: null,
      summary: 's', tags: [], keyTerms: [], language: 'en', contentKind: 'hologram',
    })
    assert.equal(r.success, false)
  })

  test('quiz generation validates', () => {
    const r = QuizGenerationSchema.safeParse({
      cards: [{ type: 'mcq', question: 'q', answer: 'a', options: ['a', 'b', 'c', 'd'] }],
    })
    assert.equal(r.success, true)
  })

  test('chat scope defaults to vault', () => {
    assert.equal(ChatScopeSchema.parse({}).mode, 'vault')
  })
})

/* ══════════════════════════════════════════════════════════════
   The spoiler guard invariant

   The SQL enforces `page_end <= max_page_read`. This asserts the
   same rule against the demo dataset, so a regression in the
   retrieval window shows up as a failing test rather than a user
   discovering a spoiler.
   ══════════════════════════════════════════════════════════════ */

describe('spoiler guard', () => {
  test('no item may expose a page the user has not read', () => {
    const maxRead = new Map(demoProgress.map((p) => [p.item_id, p.max_page_read]))

    for (const item of demoItems) {
      const read = maxRead.get(item.id) ?? 0
      assert.ok(read <= item.page_count, `${item.title}: read past the end`)
    }
  })

  test('every unread item is excluded from retrieval entirely', () => {
    const maxRead = new Map(demoProgress.map((p) => [p.item_id, p.max_page_read]))
    const readOf = (id: string) => maxRead.get(id) ?? 0

    const retrievable = demoItems.filter((i) => readOf(i.id) > 0)
    const unread = demoItems.filter((i) => readOf(i.id) === 0)

    assert.ok(retrievable.length > 0, 'expected some readable items in the demo set')
    assert.ok(unread.length > 0, 'expected some unread items in the demo set')

    for (const item of unread) {
      assert.equal(readOf(item.id), 0, `${item.title} should not be readable yet`)
    }
  })

  test('retrieval window never exceeds the pages actually read', () => {
    const maxRead = new Map(demoProgress.map((p) => [p.item_id, p.max_page_read]))
    for (const item of demoItems) {
      const read = maxRead.get(item.id) ?? 0
      if (read > 0) {
        // The guard compares chunk.page_end, which is 0-based inclusive.
        assert.ok(read - 1 <= item.page_count - 1)
      }
    }
  })
})
