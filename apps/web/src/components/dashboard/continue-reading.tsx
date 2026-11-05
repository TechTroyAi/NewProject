'use client'
import * as React from 'react'
import Link from 'next/link'
import { BookOpen, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mockCover } from '@/lib/demo'

export interface ContinueItem {
  id: string
  title: string
  page: number
  pageCount: number
  percent: number
  seriesTitle?: string | null
  kind?: string
}

export function ContinueReading({ items }: { items: ContinueItem[] }) {
  if (!items.length) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[13px] font-medium">Nothing in progress</p>
        <p className="mt-1 text-[12px] text-faint">Drop a file and start reading — it&apos;ll wait for you here.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((it) => (
        <Link key={it.id} href={`/app/read/${it.id}?p=${it.page}`} className="group block">
          <div className="relative aspect-[3/4.2] overflow-hidden rounded-xl border border-line/8 transition duration-200 group-hover:-translate-y-1 group-hover:border-line/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mockCover(it.seriesTitle ?? it.title, it.kind ?? 'manga')}
              alt={it.title}
              className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <ProgressRing percent={it.percent} />
            <div className="absolute inset-x-0 bottom-0 p-2">
              <p className="truncate text-[11.5px] font-semibold leading-tight text-white drop-shadow">
                {it.seriesTitle ?? it.title}
              </p>
              <p className="mt-0.5 text-[10px] text-white/65">
                p.{it.page + 1} / {it.pageCount}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 13
  const c = 2 * Math.PI * r
  const on = (percent / 100) * c
  return (
    <svg viewBox="0 0 32 32" className="absolute right-2 top-2 size-8 -rotate-90">
      <circle cx="16" cy="16" r={r} fill="rgb(0 0 0 / .35)" stroke="rgb(255 255 255 / .2)" strokeWidth="3" />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke="rgb(var(--series))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${on} ${c}`}
      />
    </svg>
  )
}

export function AiSuggestStrip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-line/8 bg-accent/[.05] px-4 py-3">
      <span
        className="mt-px grid size-5 shrink-0 place-items-center rounded-md text-white"
        style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
      >
        <Sparkles className="size-3" />
      </span>
      <p className="text-[12px] leading-relaxed text-muted">
        <span className="font-medium text-fg">Assistant:</span> {text}
      </p>
    </div>
  )
}

export function ReadingRow({ items }: { items: ContinueItem[] }) {
  return (
    <ul className="divide-y divide-line/5">
      {items.map((it) => (
        <li key={it.id}>
          <Link
            href={`/app/read/${it.id}?p=${it.page}`}
            className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-raised/50"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-raised text-faint">
              <BookOpen className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">{it.title}</span>
              <span className="block text-[11px] text-faint">
                {it.seriesTitle} · p.{it.page + 1}/{it.pageCount}
              </span>
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-faint">{Math.round(it.percent)}%</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
