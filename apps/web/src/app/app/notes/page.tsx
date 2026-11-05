import Link from 'next/link'
import { FileText, Plus, Search, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/primitives'
import { getClip, getNotes, getLinks } from '@/lib/data'
import { ClipView } from '@/components/reader/clip-view'
import { relativeTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function NotesPage({ searchParams }: { searchParams: { q?: string; clip?: string } }) {
  const [notes, links] = await Promise.all([getNotes(), getLinks()])
  const clip = searchParams.clip ? await getClip(searchParams.clip) : null
  const q = searchParams.q?.toLowerCase() ?? ''
  const filtered = q
    ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.body_md.toLowerCase().includes(q))
    : notes

  const backlinkCount = (id: string) => links.filter((l) => l.to_note === id).length

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-3 pb-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-[-.02em]">Notes</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {notes.length} notes · markdown with <span className="text-accent">[[wikilinks]]</span> that resolve to
            pages
          </p>
        </div>
        <Link href="/app/notes/new">
          <Button size="sm">
            <Plus /> New note
          </Button>
        </Link>
      </div>

      {clip && (
        <div className="mb-4 max-w-sm">
          <ClipView clip={clip} />
        </div>
      )}

      <form className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search notes…" className="pl-8" />
        </div>
        <Button variant="secondary" size="sm" type="submit">
          <Search /> Find
        </Button>
      </form>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<FileText className="size-5" />}
              title={q ? 'No notes match' : 'No notes yet'}
              description={
                q
                  ? 'Try a different phrase, or search the whole shelf with ⌘K.'
                  : 'Write one. Link it to a page with [[Blue Lock#Ch184 p12]] and it shows up in the graph.'
              }
              action={
                <Link href="/app/notes/new">
                  <Button size="sm">Write a note</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {filtered.map((n) => {
            const bl = backlinkCount(n.id)
            return (
              <Link key={n.id} href={`/app/notes/${n.id}`} className="group">
                <Card className="h-full transition duration-200 group-hover:border-line/18 group-hover:bg-surface/80">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                          n.is_ai_draft ? 'bg-wiki/12 text-wiki' : 'bg-accent/12 text-accent'
                        }`}
                      >
                        {n.is_ai_draft ? <Sparkles className="size-3.5" /> : <FileText className="size-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium">{n.title}</p>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                          {n.body_md.replace(/[#>*_`\[\]]/g, '').replace(/\n+/g, ' ').slice(0, 130)}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-faint">
                          <span>{relativeTime(n.updated_at)}</span>
                          {bl > 0 && <span>· {bl} backlink{bl === 1 ? '' : 's'}</span>}
                          {n.page_ref !== null && n.page_ref !== undefined && (
                            <span className="text-series">· anchored p.{n.page_ref + 1}</span>
                          )}
                          {n.is_ai_draft && <Badge tone="wiki">ai</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
