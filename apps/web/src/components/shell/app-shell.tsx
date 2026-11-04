'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Boxes, FileText, Layers, Network, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { TopBar } from './topbar'
import { RightPanel } from './right-panel'
import { CommandPalette } from './command-palette'
import { GlobalDrop, UploadTray } from '@/components/upload/global-drop'
import { useHotkeys } from '@/lib/hotkeys'
import { useScopeStore } from '@/lib/scope-store'

const MOBILE_TABS = [
  { href: '/app', label: 'Home', icon: Boxes },
  { href: '/app/library', label: 'Library', icon: Layers },
  { href: '/app/notes', label: 'Notes', icon: FileText },
  { href: '/app/quiz', label: 'Quiz', icon: Target },
  { href: '/app/graph', label: 'Graph', icon: Network },
]

export function AppShell({
  children,
  series = [],
}: {
  children: React.ReactNode
  series?: { id: string; title: string; kind: string }[]
}) {
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const setScope = useScopeStore((s) => s.setScope)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The reader binds `n` to its notes panel, so the shell's single-key
  // shortcuts stand down there — otherwise pressing `n` would navigate
  // away from the page you are reading.
  const readerOwnsKeyboard = pathname.startsWith('/app/read/')

  useHotkeys(
    {
      g: () => router.push('/app/graph'),
      n: () => router.push('/app/notes/new'),
      q: () => router.push('/app/quiz/session'),
      l: () => router.push('/app/library'),
    },
    [router],
    !readerOwnsKeyboard,
  )

  // Reset AI scope when leaving a scoped surface.
  React.useEffect(() => {
    if (pathname.startsWith('/app/read/')) return
    if (pathname.startsWith('/app/notes/') && pathname !== '/app/notes/new') return
    setScope({ mode: 'vault' })
  }, [pathname, setScope])

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <Sidebar series={series as never} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>

      <RightPanel />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <GlobalDrop />
      <UploadTray />

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-line/10 bg-bg/90 backdrop-blur-xl md:hidden">
        {MOBILE_TABS.map((t) => {
          const active = t.href === '/app' ? pathname === '/app' : pathname.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition',
                active ? 'text-accent' : 'text-faint',
              )}
            >
              <t.icon className="size-[18px]" />
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
