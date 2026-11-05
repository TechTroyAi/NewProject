'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TrashEntry } from '@/lib/trash'

const KIND_LABEL: Record<string, string> = {
  note: 'Note',
  item: 'Item',
  deck: 'Deck',
  card: 'Card',
  clip: 'Clip',
}

/** The trash: what was deleted, how long it has left, and a way back. */
export function TrashClient({ entries }: { entries: TrashEntry[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = React.useState<string | null>(null)

  async function restore(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/trash/${id}/restore`, { method: 'POST' })
      if (!res.ok) {
        toast.error('Could not restore it')
        return
      }
      toast.success('Restored')
      router.refresh()
    } catch {
      toast.error('Could not reach the server')
    } finally {
      setBusyId(null)
    }
  }

  async function purge(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/trash/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not delete it')
        return
      }
      toast.success('Deleted for good')
      router.refresh()
    } catch {
      toast.error('Could not reach the server')
    } finally {
      setBusyId(null)
    }
  }

  async function empty() {
    setBusyId('all')
    try {
      const res = await fetch('/api/trash', { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not empty the trash')
        return
      }
      toast.success('Trash emptied')
      router.refresh()
    } catch {
      toast.error('Could not reach the server')
    } finally {
      setBusyId(null)
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line/12 px-6 py-14 text-center">
        <Archive className="mx-auto size-6 text-faint" />
        <p className="mt-3 text-[13px] text-muted">The trash is empty</p>
        <p className="mt-1 text-[12px] text-faint">
          Deleted notes, items, decks and cards wait here for 30 days before they are gone for good.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <Button size="sm" variant="ghost" onClick={empty} disabled={busyId === 'all'}>
          <Trash2 /> Empty trash
        </Button>
      </div>

      <ul className="divide-y divide-line/5 overflow-hidden rounded-xl border border-line/10">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 bg-surface/40 px-4 py-3">
            <Badge tone={e.entityType === 'note' ? 'accent' : 'default'} className="shrink-0">
              {KIND_LABEL[e.entityType] ?? e.entityType}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{e.label}</p>
              <p className={cn('text-[11.5px]', e.daysLeft <= 3 ? 'text-warn' : 'text-faint')}>
                {e.daysLeft > 0
                  ? `${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'} left before it is purged`
                  : 'expired — it will be purged shortly'}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => restore(e.id)}
              disabled={busyId === e.id}
              aria-label={`Restore ${e.label}`}
            >
              <RotateCcw /> Restore
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => purge(e.id)}
              disabled={busyId === e.id}
              aria-label={`Delete ${e.label} for good`}
              title="Delete for good"
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
