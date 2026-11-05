import { notFound } from 'next/navigation'
import { NoteEditor } from '@/components/notes/editor'
import { QuizGenerator } from '@/components/quiz/quiz-generator'
import { getBacklinks, getItems, getNoteById, getNotes, getSeriesList, listAllClips } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function NotePage({
  params,
  searchParams,
}: {
  params: { noteId: string }
  searchParams: { title?: string; body?: string; draft?: string; item?: string; page?: string }
}) {
  const [note, notes, items, series, clips] = await Promise.all([
    getNoteById(params.noteId),
    getNotes(),
    getItems(),
    getSeriesList(),
    listAllClips(),
  ])

  // `/app/notes/new` → start a blank note. Unresolved wikilinks link
  // here with the title they were after, so it must not be dropped.
  const isNew = params.noteId === 'new'
  const prefill = (searchParams?.title ?? '').trim().slice(0, 200)
  const prefillBody = (searchParams?.body ?? '').slice(0, 20_000)
  const isDraft = searchParams?.draft === '1'
  // A note can be anchored to the item and page it was taken from —
  // the reader links here with `?item=&page=`.
  const anchorItem = searchParams?.item?.trim() || null
  const anchorPage = Number.parseInt(searchParams?.page ?? '', 10)
  const resolvedNote = isNew
    ? {
        id: 'new',
        title: prefill,
        body_md: prefillBody,
        item_id: anchorItem,
        page_ref: Number.isFinite(anchorPage) && anchorPage >= 0 ? anchorPage : null,
        is_ai_draft: isDraft,
      }
    : note

  if (!resolvedNote && !isNew) notFound()
  if (!resolvedNote) notFound()

  const backlinks = isNew ? [] : await getBacklinks(params.noteId)

  const itemTitle = new Map(items.map((i) => [i.id, i.title]))
  const targets = [
    ...notes.map((n) => ({ id: n.id, title: n.title, kind: 'note' as const, subtitle: null })),
    ...clips.map((c) => ({
      id: c.id,
      title: `Clip · ${itemTitle.get(c.item_id) ?? 'item'} p.${c.page_idx + 1}`,
      kind: 'clip' as const,
      subtitle: null,
      linkText: `clip:${c.id}`,
    })),
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
    <div className="flex h-full flex-col">
      <NoteEditor note={resolvedNote} targets={targets} backlinks={backlinks} />
      {!isNew && resolvedNote && (
        <div className="border-t border-line/8 bg-surface/40 px-4 py-2.5">
          <QuizGenerator
            noteId={resolvedNote.id}
            noteTitle={resolvedNote.title}
            itemId={resolvedNote.item_id ?? null}
          />
        </div>
      )}
    </div>
  )
}
