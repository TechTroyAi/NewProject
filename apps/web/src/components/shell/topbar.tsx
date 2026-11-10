'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Command,
  Moon,
  PanelRightOpen,
  Plus,
  Sun,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/overlay'
import { Tooltip } from '@/components/ui/primitives'
import { useScopeStore } from '@/lib/scope-store'
import { useTheme } from '@/lib/theme'
import { THEMES } from '@shelf/shared'
import { useUploadStore } from '@/lib/upload-store'

const CRUMBS: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/library': 'Library',
  '/app/notes': 'Notes',
  '/app/quiz': 'Quiz',
  '/app/graph': 'Graph',
  '/app/sources': 'Sources',
  '/app/inbox': 'Inbox',
  '/app/stats': 'Stats',
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const pathname = usePathname()
  const { panelOpen, setPanelOpen } = useScopeStore()
  const { theme, setTheme } = useTheme()
  const setUploadOpen = useUploadStore((s) => s.setOpen)

  const crumb = CRUMBS[pathname] ?? (pathname.split('/')[2] ? pathname.split('/')[2].replace(/-/g, ' ') : 'Shelf')

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line/8 bg-bg/80 px-3 backdrop-blur-xl sm:px-4">
      <button
        onClick={onOpenPalette}
        className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line/8 bg-surface/70 px-3 text-left transition hover:border-line/18 hover:bg-surface sm:max-w-md"
      >
        <Command className="size-3.5 shrink-0 text-faint" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-faint">
          Search notes, items, ask AI…
        </span>
        <kbd className="kbd hidden sm:inline-flex">⌘K</kbd>
      </button>

      <span className="hidden text-[12px] capitalize text-faint lg:block">{crumb}</span>

      <span className="flex-1" />

      <Button size="sm" variant="secondary" onClick={() => setUploadOpen(true)} className="hidden sm:inline-flex">
        <Upload />
        Upload
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={() => setUploadOpen(true)} className="sm:hidden" aria-label="Upload">
        <Upload />
      </Button>

      <Button size="icon-sm" variant="ghost" aria-label="New note">
        <Plus />
      </Button>

      <Dropdown
        trigger={
          <button className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg" aria-label="Theme">
            {theme === 'paper' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        }
      >
        <DropdownLabel>Theme</DropdownLabel>
        {THEMES.map((t) => (
          <DropdownItem key={t} onSelect={() => setTheme(t)} shortcut={t === theme ? '✓' : undefined}>
            <span className="capitalize">{t}</span>
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem onSelect={() => setTheme('paper')}>Paper</DropdownItem>
        <DropdownItem onSelect={() => setTheme('midnight')}>Midnight</DropdownItem>
        <DropdownItem onSelect={() => setTheme('amoled')}>AMOLED</DropdownItem>
      </Dropdown>

      <Tooltip label="Notifications">
        <button className="relative grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg" aria-label="Notifications">
          <Bell className="size-4" />
          <span className="absolute right-1 top-1 size-1.5 rounded-full bg-bad" />
        </button>
      </Tooltip>

      {!panelOpen && (
        <Tooltip label="Open assistant">
          <button
            onClick={() => setPanelOpen(true)}
            className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg lg:hidden"
            aria-label="Open assistant"
          >
            <PanelRightOpen className="size-4" />
          </button>
        </Tooltip>
      )}
    </header>
  )
}
