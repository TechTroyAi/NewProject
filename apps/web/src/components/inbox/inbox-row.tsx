'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, FolderPlus, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface InboxCandidate {
  id: string
  title: string
  score: number
}

/**
 * One item waiting in the Inbox.
 *
 * The worker could not place it with enough confidence, so the user
 * picks the series — or starts a new one from the item's own title.
 */
export function InboxRow({
  itemId,
  title,
  candidates,
}: {
  itemId: string
  title: string
  candidates: InboxCandidate[]
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  async function file(seriesId: string | null) {
    if (busy) return
    setBusy(seriesId ?? 'new')
    try {
      const res = await fetch(`/api/inbox/${itemId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seriesId }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `could not file this item (${res.status})`)
      setDone(true)
      toast.success(seriesId ? 'Filed into the series.' : 'Started a new series for it.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-good/25 bg-good/8 px-3 py-2 text-[12px] text-good">
        <Check className="size-3.5" /> Filed — {title}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {candidates.length > 0 ? (
        candidates.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant="secondary"
            disabled={!!busy}
            onClick={() => void file(c.id)}
            title={`${Math.round(c.score * 100)}% match`}
            className={cn('gap-1.5')}
          >
            {busy === c.id ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {c.title}
            <span className="text-[10px] text-faint">{Math.round(c.score * 100)}%</span>
          </Button>
        ))
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={!!busy}
        onClick={() => void file(null)}
        title="Start a new series named after this file"
      >
        {busy === 'new' ? <Loader2 className="animate-spin" /> : <FolderPlus />}
        New series
      </Button>
    </div>
  )
}

/** The "skip" affordance — a plain link so it cannot be mistaken for an action. */
export function InboxSkip() {
  return (
    <Link href="/app/library" className="text-[11.5px] text-faint underline-offset-4 transition hover:text-fg hover:underline">
      Skip
    </Link>
  )
}
