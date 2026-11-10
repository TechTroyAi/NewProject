import { Archive } from 'lucide-react'
import { listTrash, purgeExpiredTrash } from '@/lib/trash'
import { TrashClient } from '@/components/trash/trash-client'
import { TRASH_RETENTION_DAYS } from '@shelf/shared'

export const dynamic = 'force-dynamic'

export default async function TrashPage() {
  // Entries past their window are swept away when the trash is opened,
  // so an abandoned trash cleans itself up.
  await purgeExpiredTrash().catch(() => 0)
  const entries = await listTrash()

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6">
      <div className="pb-4">
        <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-.02em]">
          <Archive className="size-5 text-faint" />
          Trash
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Deleted notes, items, decks, cards and clips wait here for {TRASH_RETENTION_DAYS} days. Restore
          anything you want back; the rest is purged for good.
        </p>
      </div>

      <TrashClient entries={entries} />
    </div>
  )
}
