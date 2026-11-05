import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { getSessionClient } from '@/lib/session'
import { IS_DEMO } from '@/lib/db'
import { createZip, safeEntryName, type ZipEntry } from '@/lib/zip'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TABLES = [
  'profiles',
  'series',
  'items',
  'pages',
  'chunks',
  'progress',
  'notes',
  'links',
  'clips',
  'highlights',
  'decks',
  'cards',
  'reviews',
  'tags',
  'item_tags',
  'collections',
  'collection_items',
  'jobs',
  'ai_usage',
  'daily_activity',
  'sources',
] as const

interface NoteRow {
  id: string
  title: string
  body_md: string
  updated_at?: string
}

/**
 * Export everything Shelf holds about the signed-in user.
 *
 * `?format=json` returns one JSON document.
 * `?format=zip` returns an archive with the notes as markdown — the
 * folder can be dropped straight into Obsidian — plus the raw data.
 *
 * Row Level Security means the session client can only ever see the
 * caller's own rows, so this cannot leak anybody else's data.
 */
export async function GET(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const url = new URL(req.url)
  const format = url.searchParams.get('format') === 'zip' ? 'zip' : 'json'

  // Demo mode has no database behind it — export the seeded dataset
  // so the feature still does something useful.
  if (IS_DEMO) {
    const { demoCards, demoDecks, demoItems, demoLinks, demoNotes, demoProgress, demoSeries } =
      await import('@/lib/demo')
    return respond(format, {
      profiles: [],
      series: demoSeries,
      items: demoItems,
      pages: [],
      chunks: [],
      progress: demoProgress,
      notes: demoNotes,
      links: demoLinks,
      clips: [],
      highlights: [],
      decks: demoDecks,
      cards: demoCards,
      reviews: [],
      tags: [],
      item_tags: [],
      collections: [],
      collection_items: [],
      jobs: [],
      ai_usage: [],
      daily_activity: [],
      sources: [],
    })
  }

  const sb = await getSessionClient()
  if (!sb) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const exportData: Record<string, unknown> = {}
  for (const table of TABLES) {
    const { data, error } = await sb.from(table).select('*')
    if (error) {
      // A table that does not exist in this deployment is skipped
      // rather than failing the whole export.
      exportData[table] = { error: error.message }
      continue
    }
    exportData[table] = data ?? []
  }

  return respond(format, exportData)
}

function respond(format: 'json' | 'zip', exportData: Record<string, unknown>): NextResponse {
  const stamp = new Date().toISOString()
  const payload = { exportedAt: stamp, schema: 'shelf/v1', data: exportData }

  if (format === 'json') {
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="shelf-export-${stamp.slice(0, 10)}.json"`,
        'cache-control': 'no-store',
      },
    })
  }

  const notes = (exportData.notes ?? []) as NoteRow[]
  const entries: ZipEntry[] = []
  const used = new Set<string>()

  for (const note of notes) {
    let name = `notes/${safeEntryName(note.title)}.md`
    let n = 2
    while (used.has(name)) name = `notes/${safeEntryName(note.title)} (${n++}).md`
    used.add(name)
    const front = [
      '---',
      `title: ${JSON.stringify(note.title)}`,
      `id: ${note.id}`,
      note.updated_at ? `updated: ${note.updated_at}` : null,
      '---',
      '',
    ]
      .filter((l) => l !== null)
      .join('\n')
    entries.push({ name, data: Buffer.from(`${front}${note.body_md ?? ''}\n`, 'utf8') })
  }

  entries.push({
    name: 'shelf.json',
    data: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
  })
  entries.push({
    name: 'README.txt',
    data: Buffer.from(
      [
        'Shelf export',
        '',
        `Exported: ${stamp}`,
        '',
        'notes/',
        '  Every note as markdown with YAML front matter. The folder can be',
        '  dropped straight into Obsidian; [[wikilinks]] are preserved.',
        '',
        'shelf.json',
        '  The complete database dump — series, items, pages, notes, cards,',
        '  reviews, progress and settings.',
        '',
      ].join('\n'),
      'utf8',
    ),
  })

  const zip = createZip(entries)
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="shelf-export-${stamp.slice(0, 10)}.zip"`,
      'cache-control': 'no-store',
    },
  })
}
