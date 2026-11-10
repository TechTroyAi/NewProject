'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TrashEntityType } from '@shelf/shared'

/**
 * Delete something — into the trash, not into the void.
 *
 * The toast that follows carries an Undo, so a mis-click is one tap
 * away from being undone rather than a trip to the trash.
 */
export function DeleteToTrashButton({
  entityType,
  entityId,
  title,
  redirectTo,
  className,
  label,
}: {
  entityType: TrashEntityType
  entityId: string
  title: string
  /** Where to go once the row is gone. */
  redirectTo?: string
  className?: string
  label?: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(t)
  }, [confirming])

  async function remove() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entityType, entityId }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        toast.error(detail?.error ?? 'Could not move it to the trash')
        setConfirming(false)
        return
      }
      const { entry } = (await res.json()) as { entry: { id: string } }

      toast.success(`“${title}” moved to the trash`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            const r = await fetch(`/api/trash/${entry.id}/restore`, { method: 'POST' })
            if (!r.ok) {
              toast.error('Could not restore it')
              return
            }
            toast.success('Restored')
            router.refresh()
          },
        },
      })

      setConfirming(false)
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } catch {
      toast.error('Could not reach the server')
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
          Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    )
  }

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className={className}
      onClick={() => setConfirming(true)}
      disabled={busy}
      aria-label={label ?? `Delete ${title}`}
      title={label ?? 'Move to trash'}
    >
      <Trash2 />
    </Button>
  )
}
