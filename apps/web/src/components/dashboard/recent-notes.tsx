'use client'
import * as React from 'react'
import Link from 'next/link'
import { FileText, Link2, Sparkles } from 'lucide-react'
import { cn, relativeTime } from '@/lib/utils'

export interface NoteRow {
  id: string
  title: string
  updated_at: string
  is_ai_draft?: boolean
  backlinks?: number
  excerpt?: string
}

export function RecentNotes({ notes }: { notes: NoteRow[] }) {
  if (!notes.length) {
    return <div className="px-4 py-10 text-center text-[12.5px] text-faint">No notes yet.</div>
  }
  return (
    <ul className="p-1.5">
      {notes.map((n) => (
        <li key={n.id}>
          <Link
            href={`/app/notes/${n.id}`}
            className="group flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-raised/50"
          >
            <span
              className={cn(
                'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg transition',
                n.is_ai_draft
                  ? 'bg-wiki/12 text-wiki'
                  : 'bg-accent/12 text-accent',
              )}
            >
              {n.is_ai_draft ? <Sparkles className="size-3.5" /> : <FileText className="size-3.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium">{n.title}</span>
                {n.backlinks ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-raised px-1 py-px text-[10px] text-faint">
                    <Link2 className="size-2.5" />
                    {n.backlinks}
                  </span>
                ) : null}
              </span>
              {n.excerpt && (
                <span className="mt-0.5 line-clamp-1 block text-[11.5px] text-faint">{n.excerpt}</span>
              )}
            </span>
            <span className="shrink-0 pt-0.5 text-[10.5px] text-faint">{relativeTime(n.updated_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
