'use client'
import * as React from 'react'
import { KeyRound, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/input'
import { toast } from 'sonner'

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
] as const

interface StoredKey {
  provider: string
  fingerprint: string
  updated_at: string
}

/**
 * Bring your own provider key.
 *
 * The key is encrypted with AES-256-GCM on the server before it is
 * stored, and it is never sent back to the browser — only a short
 * fingerprint, so the user can tell which key is in use.
 */
export function ApiKeyField() {
  const [keys, setKeys] = React.useState<StoredKey[]>([])
  const [canStore, setCanStore] = React.useState(true)
  const [provider, setProvider] = React.useState<string>('gemini')
  const [value, setValue] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/settings/api-key')
      if (!res.ok) return
      const body = await res.json().catch(() => null)
      setKeys(body?.keys ?? [])
      setCanStore(body?.canStore ?? true)
    } catch {
      /* the panel simply stays empty */
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!value.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, key: value.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `could not save the key (${res.status})`)
      setValue('')
      toast.success('Key stored. It is used for your requests from now on.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/settings/api-key?provider=${encodeURIComponent(p)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`could not remove the key (${res.status})`)
      toast.success('Key removed.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <Label>Your own API key</Label>

      {!canStore && (
        <p className="rounded-lg border border-warn/30 bg-warn/8 px-2.5 py-2 text-[11.5px] leading-relaxed text-warn/90">
          This server has no <span className="font-mono">SHELF_ENCRYPTION_KEY</span> configured, so keys cannot be
          encrypted and stored. Set one on the server to enable this. The server-level key keeps working either way.
        </p>
      )}

      {keys.length > 0 && (
        <ul className="space-y-1">
          {keys.map((k) => (
            <li
              key={k.provider}
              className="flex items-center gap-2 rounded-lg border border-line/10 bg-raised/50 px-2.5 py-1.5"
            >
              <KeyRound className="size-3 text-accent" />
              <span className="text-[12px] font-medium">{k.provider}</span>
              <span className="font-mono text-[11px] text-faint">…{k.fingerprint}</span>
              <span className="flex-1" />
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void remove(k.provider)}
                aria-label={`Remove the ${k.provider} key`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={!canStore || busy}
          className="h-9 rounded-xl border border-line/10 bg-raised/60 px-2.5 text-[12.5px] text-fg outline-none"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="AQ.… / sk-…"
          disabled={!canStore || busy}
          className="max-w-sm font-mono"
        />
        <Button onClick={() => void save()} disabled={busy || !value.trim() || !canStore}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Store
        </Button>
      </div>

      <p className="text-[11.5px] leading-relaxed text-faint">
        Encrypted with AES-256-GCM before it is written, never sent back to the browser, and never logged. The
        server-level key stays as the fallback — set{' '}
        <span className="font-mono">GEMINI_API_KEY</span>, <span className="font-mono">OPENAI_API_KEY</span> or{' '}
        <span className="font-mono">ANTHROPIC_API_KEY</span> on the server instead.
      </p>
    </div>
  )
}
