import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { safeFileName, MAX_UPLOAD_BYTES, interleaveBySeries } from '@shelf/shared'
import { sanitizeUntrustedHtml, htmlToText } from '../apps/worker/src/stages/sanitize-html.ts'
import { sanitizeHtml } from '../apps/web/src/lib/markdown.ts'
import { createZip, safeEntryName } from '../apps/web/src/lib/zip.ts'
import { ratingToGrade } from '../apps/web/src/lib/fsrs.ts'
import { Rating } from 'ts-fsrs'
import type { Card } from '@shelf/shared'

/* ══════════════════════════════════════════════════════════════
   Upload paths
   ══════════════════════════════════════════════════════════════ */

describe('safeFileName', () => {
  test('strips directory components', () => {
    assert.equal(safeFileName('../../etc/passwd'), 'passwd')
    assert.equal(safeFileName('a/b/c.png'), 'c.png')
    assert.equal(safeFileName('C:\\windows\\system32\\x.pdf'), 'x.pdf')
  })

  test('never returns a dot-file that could escape a directory', () => {
    assert.notEqual(safeFileName('..'), '..')
    assert.notEqual(safeFileName('.'), '.')
    assert.equal(safeFileName('...'), 'file')
  })

  test('removes exotic characters and bounds the length', () => {
    assert.equal(safeFileName('my "file"; rm -rf.png'), 'my _file_ rm -rf.png')
    assert.ok(safeFileName('x'.repeat(500)).length <= 180)
  })

  test('falls back to a usable name', () => {
    assert.equal(safeFileName(''), 'file')
    assert.equal(safeFileName('///'), 'file')
  })

  test('the upload ceiling is finite', () => {
    assert.ok(MAX_UPLOAD_BYTES > 0 && MAX_UPLOAD_BYTES <= 1024 ** 3)
  })
})

/* ══════════════════════════════════════════════════════════════
   Markdown sanitisation
   ══════════════════════════════════════════════════════════════ */

describe('sanitizeHtml', () => {
  test('removes inline event handlers', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">')
    assert.ok(!/onerror/i.test(out))
  })

  test('removes script tags entirely', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>')
    assert.ok(!/<script/i.test(out))
    assert.ok(out.includes('ok'))
  })

  test('removes javascript: urls', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
    assert.ok(!/javascript:/i.test(out))
  })

  test('keeps the wikilink attributes the editor relies on', () => {
    const out = sanitizeHtml(
      '<a href="/app/notes/n-1" class="wikilink" data-resolved="true" data-target="note">x</a>',
    )
    assert.ok(out.includes('data-resolved="true"'))
    assert.ok(out.includes('data-target="note"'))
    assert.ok(out.includes('class="wikilink"'))
    assert.ok(out.includes('href="/app/notes/n-1"'))
  })

  test('keeps ordinary markdown output intact', () => {
    const out = sanitizeHtml('<p><strong>bold</strong> and <em>italic</em></p><ul><li>x</li></ul>')
    assert.ok(out.includes('<strong>bold</strong>'))
    assert.ok(out.includes('<li>x</li>'))
  })
})

/* ══════════════════════════════════════════════════════════════
   Untrusted EPUB / OOXML markup
   ══════════════════════════════════════════════════════════════ */

describe('sanitizeUntrustedHtml', () => {
  test('drops script elements', () => {
    const out = sanitizeUntrustedHtml('<p>a</p><script>fetch("http://evil")</script>')
    assert.ok(!/<script/i.test(out))
    assert.ok(!/evil/.test(out))
  })

  test('drops file: urls that would read the worker sandbox', () => {
    const out = sanitizeUntrustedHtml('<img src="file:///proc/self/environ">')
    assert.ok(!/file:\/\//i.test(out))
  })

  test('drops http urls', () => {
    const out = sanitizeUntrustedHtml('<img src="http://169.254.169.254/latest/meta-data/">')
    assert.ok(!/169\.254/.test(out))
  })

  test('drops iframes, objects and embeds', () => {
    const out = sanitizeUntrustedHtml('<iframe src="http://x"></iframe><object data="x"></object><embed src="y">')
    assert.ok(!/<iframe/i.test(out))
    assert.ok(!/<object/i.test(out))
    assert.ok(!/<embed/i.test(out))
  })

  test('drops inline event handlers', () => {
    const out = sanitizeUntrustedHtml('<div onclick="steal()">x</div>')
    assert.ok(!/onclick/i.test(out))
  })

  test('drops meta refresh redirects', () => {
    const out = sanitizeUntrustedHtml('<meta http-equiv="refresh" content="0;url=http://x">')
    assert.ok(!/http-equiv/i.test(out))
  })

  test('drops css url() fetches', () => {
    const out = sanitizeUntrustedHtml('<style>body{background:url(http://evil/x.png)}</style>')
    assert.ok(!/url\(\s*['"]?http/i.test(out))
  })

  test('keeps inline images and relative paths', () => {
    const out = sanitizeUntrustedHtml('<img src="data:image/png;base64,AAA"><img src="images/cover.png">')
    assert.ok(out.includes('data:image/png'))
    assert.ok(out.includes('images/cover.png'))
  })

  test('htmlToText strips markup but keeps the words', () => {
    const text = htmlToText('<h1>Title</h1><p>Hello &amp; goodbye</p>')
    assert.ok(text.includes('Title'))
    assert.ok(text.includes('Hello & goodbye'))
    assert.ok(!text.includes('<'))
  })
})

/* ══════════════════════════════════════════════════════════════
   Quiz queue
   ══════════════════════════════════════════════════════════════ */

function card(id: string, series: string | null): Card {
  return {
    id,
    user_id: 'u',
    deck_id: 'd',
    source_note: null,
    source_item: series ? `item-${series}` : null,
    source_page: null,
    spoiler_limit_page: 0,
    type: 'flashcard',
    question: id,
    answer: id,
    options: null,
    explanation: null,
    status: 'active',
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    learning_steps: 0,
    state: 0,
    last_review: null,
  }
}

describe('interleaveBySeries', () => {
  test('alternates between series', () => {
    const cards = [
      card('a1', 'x'),
      card('a2', 'x'),
      card('a3', 'x'),
      card('b1', 'y'),
      card('b2', 'y'),
    ]
    const seriesOf = new Map([
      ['a1', 'x'], ['a2', 'x'], ['a3', 'x'],
      ['b1', 'y'], ['b2', 'y'],
    ])
    const out = interleaveBySeries(cards, seriesOf)
    assert.equal(out.length, cards.length)
    // No two consecutive cards come from the same series.
    for (let i = 1; i < out.length; i++) {
      assert.notEqual(seriesOf.get(out[i - 1].id), seriesOf.get(out[i].id))
    }
  })

  test('keeps every card exactly once', () => {
    const cards = [card('a', 'x'), card('b', 'y'), card('c', null)]
    const out = interleaveBySeries(cards, new Map())
    assert.equal(new Set(out.map((c) => c.id)).size, cards.length)
  })

  test('handles an empty list', () => {
    assert.deepEqual(interleaveBySeries([], new Map()), [])
  })
})

/* ══════════════════════════════════════════════════════════════
   FSRS grading
   ══════════════════════════════════════════════════════════════ */

describe('ratingToGrade', () => {
  test('maps 1–4 onto the ts-fsrs grades', () => {
    assert.equal(ratingToGrade(1), Rating.Again)
    assert.equal(ratingToGrade(2), Rating.Hard)
    assert.equal(ratingToGrade(3), Rating.Good)
    assert.equal(ratingToGrade(4), Rating.Easy)
  })

  test('clamps out-of-range ratings', () => {
    assert.equal(ratingToGrade(0), Rating.Again)
    assert.equal(ratingToGrade(99), Rating.Easy)
  })
})

/* ══════════════════════════════════════════════════════════════
   Export archive
   ══════════════════════════════════════════════════════════════ */

describe('createZip', () => {
  test('writes a well-formed archive', () => {
    const zip = createZip([
      { name: 'notes/Hello World.md', data: Buffer.from('# Hello\n', 'utf8') },
      { name: 'shelf.json', data: Buffer.from('{"a":1}', 'utf8') },
    ])
    // Local file header.
    assert.equal(zip.readUInt32LE(0), 0x04034b50)
    // End of central directory lives at the tail.
    const eocd = zip.length - 22
    assert.equal(zip.readUInt32LE(eocd), 0x06054b50)
    assert.equal(zip.readUInt16LE(eocd + 8), 2)
  })

  test('records the UTF-8 name flag', () => {
    const zip = createZip([{ name: 'notes/café.md', data: Buffer.from('x', 'utf8') }])
    assert.equal(zip.readUInt16LE(6) & 0x0800, 0x0800)
  })

  test('safeEntryName strips path separators and leading dots', () => {
    assert.equal(safeEntryName('../../etc/passwd'), 'passwd')
    assert.equal(safeEntryName('.hidden'), 'hidden')
    assert.equal(safeEntryName(''), 'untitled')
    assert.ok(!safeEntryName('a/b').includes('/'))
  })
})
