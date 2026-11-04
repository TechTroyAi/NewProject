'use client'
import * as React from 'react'
import Link from 'next/link'
import { Check, Compass, ExternalLink, Globe, Loader2, Plus, Search, ShieldAlert, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/primitives'

interface CatalogSource {
  key: string
  packageName: string
  extensionName: string
  catalogId: string
  name: string
  language: string
  homeUrl: string | null
  iconPath: string | null
  version: string | null
  nsfw: boolean
  adapter: string | null
  connected: boolean
}

interface ExtensionGroup {
  packageName: string
  name: string
  iconPath: string | null
  version: string | null
  nsfw: boolean
  adapter: string | null
  sourceCount: number
  connected: boolean
  sources: CatalogSource[]
}

interface Language {
  code: string
  label: string
  count: number
}

export function CatalogBrowser() {
  const [q, setQ] = React.useState('')
  const [lang, setLang] = React.useState('')
  const [nsfw, setNsfw] = React.useState(false)
  const [data, setData] = React.useState<{
    extensions: ExtensionGroup[]
    languages: Language[]
    total: number
    live: boolean
    revision: string | null
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [showAll, setShowAll] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ limit: '40', nsfw: nsfw ? '1' : '0' })
    if (lang) params.set('lang', lang)
    if (q) params.set('q', q)

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sources?${params}`)
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, lang, nsfw])

  async function toggle(source: CatalogSource) {
    setBusy(source.key)
    try {
      await fetch('/api/sources/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: source.key, disconnect: source.connected }),
      })
      const params = new URLSearchParams({ limit: '40', nsfw: nsfw ? '1' : '0' })
      if (lang) params.set('lang', lang)
      if (q) params.set('q', q)
      const res = await fetch(`/api/sources?${params}`)
      setData(await res.json())
    } finally {
      setBusy(null)
    }
  }

  const groups = data?.extensions ?? []
  const visible = showAll ? groups : groups.slice(0, 12)
  const connectedCount = groups.reduce((n, g) => n + g.sources.filter((s) => s.connected).length, 0)

  return (
    <div className="space-y-5">
      {/* ── search + filters ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 1,400+ public sources…"
            className="pl-8"
          />
        </div>
        <button
          onClick={() => setNsfw((v) => !v)}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] transition',
            nsfw ? 'border-warn/50 bg-warn/12 text-warn' : 'border-line/12 text-muted hover:text-fg',
          )}
        >
          <ShieldAlert className="size-3.5" />
          18+
        </button>
      </div>

      {/* ── language chips ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setLang('')}
          className={cn(
            'rounded-lg border px-2 py-0.5 text-[11.5px] transition',
            !lang ? 'border-accent/50 bg-accent/12 text-accent' : 'border-line/10 text-muted hover:text-fg',
          )}
        >
          All languages
        </button>
        {(data?.languages ?? []).slice(0, 18).map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(lang === l.code ? '' : l.code)}
            className={cn(
              'rounded-lg border px-2 py-0.5 text-[11.5px] transition',
              lang === l.code
                ? 'border-accent/50 bg-accent/12 text-accent'
                : 'border-line/10 text-muted hover:text-fg',
            )}
          >
            {l.label}
            <span className="ml-1 text-faint">{l.count}</span>
          </button>
        ))}
      </div>

      {/* ── status ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <Globe className="size-3.5" />
          {data?.total.toLocaleString() ?? '—'} sources
        </span>
        {connectedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-good">
            <Check className="size-3.5" />
            {connectedCount} connected
          </span>
        )}
        {data && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            {data.live ? (
              <>
                <span className="size-1.5 rounded-full bg-good" />
                live from keiyoushi/extensions
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-warn" />
                bundled snapshot (network unavailable)
              </>
            )}
          </span>
        )}
      </div>

      {/* ── grid ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[104px] rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Compass className="size-5" />}
          title="No sources match"
          description="Try a different language or clear the search."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((g) => (
              <div key={g.packageName} className="rounded-2xl border border-line/8 bg-surface p-3.5">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line/8 bg-raised">
                    {g.iconPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/sources/icon?path=${encodeURIComponent(g.iconPath)}`}
                        alt=""
                        className="size-8 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Sparkles className="size-4 text-faint" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13.5px] font-semibold">{g.name}</p>
                      {g.nsfw && <Badge tone="bad">18+</Badge>}
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-faint">
                      <span>v{g.version ?? '?'}</span>
                      <span>·</span>
                      <span>{g.sourceCount} language{g.sourceCount === 1 ? '' : 's'}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                      {g.adapter ? (
                        <span className="inline-flex items-center gap-1 text-good">
                          <span className="size-1.5 rounded-full bg-good" />
                          {g.adapter === 'mangadex' ? 'MangaDex API' : 'generic adapter'}
                        </span>
                      ) : (
                        <span className="text-faint">metadata only</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* language pills */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {g.sources.slice(0, 8).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => void toggle(s)}
                      disabled={busy === s.key}
                      title={`${s.language} — ${s.connected ? 'connected' : 'connect'}`}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10.5px] transition disabled:opacity-50',
                        s.connected
                          ? 'border-accent/50 bg-accent/12 text-accent'
                          : 'border-line/10 text-muted hover:border-accent/30 hover:text-fg',
                      )}
                    >
                      {s.connected ? <Check className="size-2.5" /> : <Plus className="size-2.5" />}
                      {s.language}
                    </button>
                  ))}
                  {g.sources.length > 8 && (
                    <span className="rounded-lg px-1.5 py-0.5 text-[10.5px] text-faint">
                      +{g.sources.length - 8}
                    </span>
                  )}
                </div>

                {/* actions */}
                <div className="mt-3 flex items-center gap-2 border-t border-line/6 pt-2.5">
                  {g.sources.find((s) => s.connected) && (
                    <Link href={`/app/sources/${encodeURIComponent(g.sources.find((s) => s.connected)!.key)}`}>
                      <Button size="sm" variant="subtle">
                        Browse
                      </Button>
                    </Link>
                  )}
                  {g.sources[0]?.homeUrl ? (
                    <a
                      href={g.sources[0]?.homeUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-[11.5px] text-faint transition hover:text-fg"
                    >
                      <ExternalLink className="size-3" />
                      site
                    </a>
                  ) : null}
                  {busy && <Loader2 className="ml-auto size-3.5 animate-spin text-accent" />}
                </div>
              </div>
            ))}
          </div>

          {groups.length > 12 && (
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show less' : `Show all ${groups.length} extensions`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
