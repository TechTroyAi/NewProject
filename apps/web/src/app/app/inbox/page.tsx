import { Inbox, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/primitives'
import { InboxRow, InboxSkip } from '@/components/inbox/inbox-row'
import { getInbox } from '@/lib/data'
import { relativeTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const items = await getInbox()

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6">
      <div className="pb-5">
        <h1 className="text-[22px] font-semibold tracking-[-.02em]">Inbox</h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Files Shelf could not confidently place. Review them once and they become part of your shelf.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Inbox className="size-5" />}
              title="Inbox zero"
              description="Everything on your shelf is filed and sorted."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <Card key={it.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn/12 text-warn">
                  <Inbox className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{it.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {it.reason} · {it.page_count} pages · {relativeTime(it.created_at)}
                  </p>
                  {it.candidates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.candidates.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-line/10 bg-raised/60 px-1.5 py-0.5 text-[11px] text-muted"
                        >
                          <Sparkles className="size-2.5 text-accent" />
                          {c.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <InboxRow itemId={it.id} title={it.title} candidates={it.candidates} />
                  <InboxSkip />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
