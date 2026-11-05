'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  Boxes,
  Compass,
  ChartNoAxesColumn,
  ChevronDown,
  FileText,
  FolderKanban,
  GraduationCap,
  Inbox,
  Layers,
  Network,
  Plus,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/primitives'
import type { Series } from '@shelf/shared'

const NAV = [
  { href: '/app', label: 'Dashboard', icon: Boxes, exact: true },
  { href: '/app/library', label: 'Library', icon: Layers },
  { href: '/app/notes', label: 'Notes', icon: FileText, count: 'notes' as const },
  { href: '/app/quiz', label: 'Quiz', icon: Target, count: 'quiz' as const },
  { href: '/app/graph', label: 'Graph', icon: Network },
  { href: '/app/sources', label: 'Sources', icon: Compass },
  { href: '/app/inbox', label: 'Inbox', icon: Inbox, count: 'inbox' as const },
  { href: '/app/stats', label: 'Stats', icon: ChartNoAxesColumn },
  { href: '/app/settings/general', label: 'Settings', icon: Settings },
]

export interface SidebarTag {
  id: string
  name: string
  color: string | null
  count: number
}

export function Sidebar({
  series = [],
  tags = [],
  counts,
}: {
  series?: Series[]
  tags?: SidebarTag[]
  counts?: { notes: number; quiz: number; inbox: number }
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside
      className={cn(
        'group/side relative hidden shrink-0 flex-col border-r border-line/8 bg-surface/40 transition-[width] duration-200 md:flex',
        collapsed ? 'w-[64px]' : 'w-[236px]',
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-2.5 px-4 pb-3 pt-4', collapsed && 'justify-center px-0')}>
        <Link href="/app" className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-[10px] text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
          >
            <BookOpen className="size-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold leading-tight tracking-tight">Shelf</span>
              <span className="block truncate text-[10.5px] leading-tight text-faint">read · think · remember</span>
            </span>
          )}
        </Link>
      </div>

      <div className={cn('px-3 pb-2', collapsed && 'px-2')}>
        <button
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border border-line/8 bg-raised/50 px-2.5 py-2 text-left transition hover:border-line/15 hover:bg-raised',
            collapsed && 'justify-center px-0',
          )}
        >
          <span className="size-2 shrink-0 rounded-full bg-good shadow-[0_0_8px_rgb(var(--good))]" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">Personal Shelf</span>
              <ChevronDown className="size-3.5 shrink-0 text-faint" />
            </>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 overflow-y-auto px-2 pb-4', collapsed && 'px-1.5')}>
        <div className={cn('px-2 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[.1em] text-faint', collapsed && 'hidden')}>
          Workspace
        </div>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact)
            const Icon = item.icon
            const link = (
              <Link
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-[13px] transition',
                  active ? 'bg-accent/12 font-medium text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg',
                  collapsed && 'justify-center px-0',
                )}
              >
                {active && (
                  <span className="absolute -left-2 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                <Icon className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-faint group-hover:text-muted')} />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.count !== undefined && (
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-px text-[10.5px] font-semibold',
                      active ? 'bg-accent/20 text-accent' : 'bg-raised text-faint',
                    )}
                  >
                    {counts ? counts[item.count] : 0}
                  </span>
                )}
              </Link>
            )
            return (
              <li key={item.href}>
                {collapsed ? (
                  <Tooltip label={item.label} side="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            )
          })}
        </ul>

        {/* Collections */}
        {!collapsed && (
          <>
            <div className="flex items-center justify-between px-2 pb-1.5 pt-5">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-faint">Collections</span>
              <button className="text-faint transition hover:text-fg" aria-label="Add collection">
                <Plus className="size-3.5" />
              </button>
            </div>
            <ul className="space-y-0.5">
              {series.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/app/library/${s.id}`}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-2.5 py-[6px] text-[12.5px] transition hover:bg-raised/60',
                      pathname === `/app/library/${s.id}` ? 'text-fg' : 'text-muted hover:text-fg',
                    )}
                  >
                    {s.kind === 'manga' ? (
                      <GraduationCap className="size-3.5 shrink-0 text-series" />
                    ) : s.kind === 'course' ? (
                      <FolderKanban className="size-3.5 shrink-0 text-accent" />
                    ) : (
                      <BookOpen className="size-3.5 shrink-0 text-wiki" />
                    )}
                    <span className="truncate">{s.title}</span>
                  </Link>
                </li>
              ))}
              {series.length === 0 && (
                <li className="px-2.5 py-1.5 text-[12px] text-faint">Drop a file to start</li>
              )}
            </ul>
          </>
        )}

        {/* Tags */}
        {!collapsed && (
          <>
            <div className="px-2 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[.1em] text-faint">
              Tags
            </div>
            <ul className="flex flex-wrap gap-1.5 px-2">
              {tags.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/app/library?tag=${encodeURIComponent(t.name)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line/8 bg-raised/60 px-1.5 py-0.5 text-[11px] text-muted transition hover:border-line/18 hover:text-fg"
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: `rgb(var(--${t.color ?? 'muted'}))` }}
                    />
                    #{t.name}
                  </Link>
                </li>
              ))}
              {tags.length === 0 && <li className="px-0.5 text-[11px] text-faint">No tags yet</li>}
            </ul>
          </>
        )}
      </nav>

      {/* User */}
      <div className={cn('border-t border-line/8 p-3', collapsed && 'px-1.5')}>
        <Link
          href="/app/settings/general"
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-1 py-1 transition hover:bg-raised/60',
            collapsed && 'justify-center px-0',
          )}
          aria-label="Settings"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[rgb(var(--wiki))] to-[rgb(var(--accent))] text-[11px] font-bold text-black">
            TR
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium leading-tight">Troy</span>
                <span className="block truncate text-[10.5px] leading-tight text-faint">Local · synced</span>
              </span>
              <Sparkles className="size-3.5 shrink-0 text-accent" />
            </>
          )}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-[68px] grid size-6 place-items-center rounded-full border border-line/12 bg-surface text-faint opacity-0 shadow-pop transition group-hover/side:opacity-100 hover:text-fg"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronDown className={cn('size-3 transition-transform', collapsed && '-rotate-90')} />
      </button>
    </aside>
  )
}
