'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Database, Download, Keyboard, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/primitives'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/input'
import { useTheme, ACCENTS } from '@/lib/theme'
import { THEMES, type Theme } from '@shelf/shared'
import { HOTKEY_HINTS } from '@/lib/hotkeys'
import { AI_PROVIDER_IDS, AI_PROVIDER_LABELS, type AiProviderId } from '@shelf/shared'
import { IS_DEMO } from '@/lib/db'

const SECTIONS = [
  { slug: 'general', label: 'General' },
  { slug: 'reader', label: 'Reader' },
  { slug: 'ai', label: 'AI' },
  { slug: 'quiz', label: 'Quiz' },
  { slug: 'data', label: 'Data' },
  { slug: 'shortcuts', label: 'Shortcuts' },
]

export function SettingsClient({
  section,
  provider,
}: {
  section: string
  provider: { id: AiProviderId | null; label: string; model: string | null; embeddingModel: string | null }
}) {
  const router = useRouter()
  const { theme, accent, setTheme, setAccent } = useTheme()
  const [busy, setBusy] = React.useState<'zip' | 'json' | 'delete' | null>(null)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function downloadExport(format: 'zip' | 'json') {
    setBusy(format)
    setMessage(null)
    try {
      const res = await fetch(`/api/account/export?format=${format}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `export failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shelf-export.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMessage('Export downloaded.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'export failed')
    } finally {
      setBusy(null)
    }
  }

  async function deleteAccount() {
    setBusy('delete')
    setMessage(null)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `delete failed (${res.status})`)
      }
      // Drop the local drafts too — they belong to the account.
      try {
        const { clearAllDrafts } = await import('@/lib/drafts')
        await clearAllDrafts()
      } catch {
        /* not fatal */
      }
      setConfirmingDelete(false)
      setMessage('Your account has been deleted.')
      router.push('/')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'delete failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6">
      <div className="pb-5">
        <h1 className="text-[22px] font-semibold tracking-[-.02em]">Settings</h1>
        <p className="mt-1 text-[12.5px] text-muted">
          {IS_DEMO ? (
            <span className="inline-flex items-center gap-1.5">
              <Badge tone="warn">demo mode</Badge>
              no database connected — changes are stored locally
            </span>
          ) : (
            'Changes are saved to your profile.'
          )}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.slug}
            onClick={() => router.push(`/app/settings/${s.slug}`)}
            className={cn(
              'rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition',
              section === s.slug ? 'bg-accent/14 text-accent' : 'text-muted hover:bg-raised hover:text-fg',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'general' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label>Theme</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {THEMES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        'rounded-xl border p-3 text-left transition',
                        theme === t ? 'border-accent bg-accent/8' : 'border-line/10 hover:border-line/20',
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-[12.5px] font-medium capitalize">{t}</span>
                        {theme === t && <Check className="size-3.5 text-accent" />}
                      </span>
                      <span className="mt-2 flex gap-1">
                        {(
                          t === 'paper'
                            ? ['#f7f6f3', '#ffffff', '#1c1b21']
                            : t === 'amoled'
                              ? ['#000000', '#0a0a0b', '#f5f5fa']
                              : ['#09090e', '#101017', '#ececf4']
                        ).map((c) => (
                          <span key={c} className="size-4 rounded border border-line/10" style={{ background: c }} />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Accent</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setAccent(a.value)}
                      className={cn(
                        'size-8 rounded-full border-2 transition-transform hover:scale-110',
                        accent === a.value ? 'border-fg' : 'border-transparent',
                      )}
                      style={{ background: a.value }}
                      title={a.name}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Display name</Label>
                <Input defaultValue="Troy" className="mt-1.5 max-w-xs" />
              </div>
              <div>
                <Label>Daily note format</Label>
                <Input defaultValue="YYYY-MM-DD · daily" className="mt-1.5 max-w-xs font-mono" />
              </div>
              <Button size="sm">Save</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {section === 'reader' && (
        <Card>
          <CardHeader>
            <CardTitle>Reader</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Default mode', desc: 'Long strip or single page', value: 'Long strip' },
              { label: 'Right-to-left reading', desc: 'For manga that reads right to left', value: false },
              { label: 'Double-page spreads', desc: 'Show two pages side by side', value: false },
              { label: 'Preload next pages', desc: 'Keep the next three pages in memory', value: true },
            ].map((row, i) => (
              <div key={row.label} className="flex items-center gap-4 border-b border-line/6 pb-4 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{row.label}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{row.desc}</p>
                </div>
                {typeof row.value === 'boolean' ? (
                  <Switch checked={row.value} onCheckedChange={() => {}} />
                ) : (
                  <span className="shrink-0 text-[12.5px] text-muted">{row.value}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {section === 'ai' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Sparkles className="size-4 text-accent" />
              <CardTitle>Assistant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 border-b border-line/6 pb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">Spoiler guard</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                    Filter retrieval by your reading progress, in SQL. Unread pages never reach the model.
                  </p>
                </div>
                <Switch checked onCheckedChange={() => {}} />
              </div>
              <div className="flex items-center gap-4 border-b border-line/6 pb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">Daily token budget</p>
                  <p className="mt-0.5 text-[12px] text-muted">Stops runaway spend with a friendly message.</p>
                </div>
                <Input defaultValue="200000" className="w-32" />
              </div>
              <div>
                <Label>Provider</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {AI_PROVIDER_IDS.map((id) => (
                    <span
                      key={id}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[12px]',
                        provider.id === id
                          ? 'border-accent/50 bg-accent/10 text-accent'
                          : 'border-line/10 text-muted',
                      )}
                    >
                      {AI_PROVIDER_LABELS[id]}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] text-faint">
                  Active: <span className="text-muted">{provider.label}</span>
                  {provider.model && (
                    <>
                      {' · '}
                      <span className="font-mono text-muted">{provider.model}</span>
                    </>
                  )}
                  {provider.embeddingModel && (
                    <>
                      {' · embeddings '}
                      <span className="font-mono text-muted">{provider.embeddingModel}</span>
                    </>
                  )}
                </p>
              </div>
              <div>
                <Label>Your own API key</Label>
                <Input type="password" placeholder="AQ.… / sk-…" className="mt-1.5 max-w-sm font-mono" />
                <p className="mt-1.5 text-[11.5px] text-faint">
                  Encrypted at rest. Never logged. Set it on the server as{' '}
                  <span className="font-mono">GEMINI_API_KEY</span>, <span className="font-mono">OPENAI_API_KEY</span> or{' '}
                  <span className="font-mono">ANTHROPIC_API_KEY</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {section === 'quiz' && (
        <Card>
          <CardHeader>
            <CardTitle>Spaced repetition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 border-b border-line/6 pb-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">New cards per day</p>
                <p className="mt-0.5 text-[12px] text-muted">Capped so the queue stays reviewable.</p>
              </div>
              <Input defaultValue="10" className="w-20" />
            </div>
            <div className="flex items-center gap-4 border-b border-line/6 pb-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">Enable quiz generation</p>
                <p className="mt-0.5 text-[12px] text-muted">Generate cards the first time you open a note.</p>
              </div>
              <Switch checked onCheckedChange={() => {}} />
            </div>
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">FSRS parameters</p>
                <p className="mt-0.5 text-[12px] text-muted">Optimised for retention with a 90% target.</p>
              </div>
              <Badge tone="accent">0.9 retention</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {section === 'data' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Database className="size-4 text-faint" />
              <CardTitle>Your data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 border-b border-line/6 pb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">Export everything</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    Every note as markdown plus the full database dump. Drop the markdown folder straight into
                    Obsidian.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadExport('zip')}
                    disabled={!!busy}
                  >
                    <Download /> {busy === 'zip' ? 'Preparing…' : 'Export .zip'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadExport('json')} disabled={!!busy}>
                    JSON
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">Delete account</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    Removes every file, note and card. Files are unrecoverable after 30 days.
                  </p>
                </div>
                <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)} disabled={!!busy}>
                  <Trash2 /> Delete
                </Button>
              </div>
              {message && (
                <p className="border-t border-line/6 pt-3 text-[12px] text-muted">{message}</p>
              )}
            </CardContent>
          </Card>

          {confirmingDelete && (
            <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl border border-line/12 bg-surface p-5 shadow-pop">
                <h2 className="text-[15px] font-semibold tracking-[-.01em]">Delete your account?</h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                  Every file, note, card and review will be removed. This cannot be undone.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={busy === 'delete'}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={() => void deleteAccount()} disabled={busy === 'delete'}>
                    {busy === 'delete' ? 'Deleting…' : 'Delete everything'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'shortcuts' && (
        <Card>
          <CardHeader>
            <Keyboard className="size-4 text-faint" />
            <CardTitle>Keyboard shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line/6">
              {HOTKEY_HINTS.map((h) => (
                <li key={h.keys} className="flex items-center gap-4 py-2.5">
                  <span className="min-w-0 flex-1 text-[13px]">{h.label}</span>
                  <span className="kbd shrink-0">{h.keys}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
