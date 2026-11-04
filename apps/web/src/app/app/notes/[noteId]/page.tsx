import { notFound } from 'next/navigation'
import { NoteEditor } from '@/components/notes/editor'
import { getBacklinks, getItems, getNoteById, getNotes, getSeriesList } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function NotePage({
  params,
  searchParams,
}: {
  params: { noteId: string }
  searchParams: { title?: string }
}) {
  const [note, notes, items, series] = await Promise.all([
    getNoteById(params.noteId),
    getNotes(),
    getItems(),
    getSeriesList(),
  ])

  // `/app/notes/new` → start a blank note. Unresolved wikilinks link
  // here with the title they were after, so it must not be dropped.
  const isNew = params.noteId === 'new'
  const prefill = (searchParams?.title ?? '').trim().slice(0, 200)
  const resolvedNote = isNew
    ? {
        id: 'new',
        title: prefill,
        body_md: '',
        item_id: null,
        page_ref: null,
        is_ai_draft: false,
      }
    : note

  if (!resolvedNote && !isNew) notFound()
  if (!resolvedNote) notFound()

  const backlinks = isNew ? [] : await getBacklinks(params.noteId)

  const targets = [
    ...notes.map((n) => ({ id: n.id, title: n.title, kind: 'note' as const, subtitle: null })),
    ...items.map((i) => ({
      id: i.id,
      title: i.title,
      kind: 'item' as const,
      subtitle: `${i.page_count}p`,
      seriesTitle: series.find((s) => s.id === i.series_id)?.title ?? null,
      chapter: i.chapter ?? null,
    })),
  ]

  return (
    <div className="h-full">
      <NoteEditor note={resolvedNote} targets={targets} backlinks={backlinks} />
    </div>
  )
}
