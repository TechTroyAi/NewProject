'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BookOpen, Loader2, Mail, KeyRound, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/input'
import { getSupabaseBrowser } from '@/lib/db'

/* ══════════════════════════════════════════════════════════════
   Sign in / sign up.

   With Supabase configured these are real credential exchanges.
   In demo mode (no database configured) the form explains that and
   offers the seeded shelf instead.
   ══════════════════════════════════════════════════════════════ */

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  // `useSearchParams` opts the tree out of static prerendering, so it
  // lives behind a Suspense boundary and the shell can still be
  // prerendered.
  return (
    <React.Suspense fallback={<AuthSkeleton />}>
      <AuthFormInner mode={mode} />
    </React.Suspense>
  )
}

function AuthFormInner({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const params = useSearchParams()
  // Where the middleware wanted to send the visitor before it bounced
  // them here. Only same-origin paths are honoured.
  const next = params.get('next')
  const redirectTo = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [displayName, setDisplayName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const isSignup = mode === 'signup'
  const sb = getSupabaseBrowser()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (!sb) {
      setNotice('Shelf is running in demo mode — no account needed. The seeded shelf is ready to explore.')
      return
    }

    setBusy(true)
    try {
      if (isSignup) {
        const { error: err } = await sb.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || undefined } },
        })
        if (err) throw err
        setNotice('Account created. Check your inbox to confirm, then sign in.')
      } else {
        const { error: err } = await sb.auth.signInWithPassword({ email, password })
        if (err) throw err
        router.push(redirectTo)
        router.refresh()
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px] px-5 py-10">
      {/* ─── brand ──────────────────────────────────────────── */}
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-[13px] font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-fg">
          <BookOpen className="size-4" />
        </span>
        Shelf
      </Link>

      <h1 className="text-[24px] font-semibold tracking-[-.02em]">
        {isSignup ? 'Create your shelf' : 'Welcome back'}
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {isSignup
          ? 'One account for your library, notes, quizzes and graph. Nothing leaves your shelf.'
          : 'Sign in to pick up where you left off.'}
      </p>

      {/* ─── form ───────────────────────────────────────────── */}
      <form onSubmit={submit} className="mt-7 space-y-3.5">
        {isSignup && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Rin"
                className="pl-8"
                autoComplete="name"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="pl-8"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-8"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </div>
          {isSignup && <p className="text-[11px] text-faint">At least 8 characters.</p>}
        </div>

        {error && (
          <p className="rounded-xl border border-bad/30 bg-bad/8 px-3 py-2 text-[12px] text-bad">{error}</p>
        )}
        {notice && (
          <p className="rounded-xl border border-line/12 bg-raised px-3 py-2 text-[12px] text-muted">{notice}</p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {isSignup ? 'Create account' : 'Sign in'}
          {!busy && <ArrowRight />}
        </Button>
      </form>

      {/* ─── demo escape hatch ──────────────────────────────── */}
      {!sb && (
        <Link href="/app" className="mt-4 block">
          <Button variant="secondary" className="w-full">
            Open the demo shelf instead
          </Button>
        </Link>
      )}

      <p className="mt-6 text-center text-[12px] text-muted">
        {isSignup ? 'Already have an account? ' : "Don't have an account? "}
        <Link href={isSignup ? '/login' : '/signup'} className="text-accent underline-offset-4 hover:underline">
          {isSignup ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </div>
  )
}


/** The prerendered fallback while the query string is resolved. */
function AuthSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[420px] px-5 py-10">
      <div className="skeleton mb-8 h-7 w-24 rounded-lg" />
      <div className="skeleton mb-2 h-7 w-56 rounded-lg" />
      <div className="skeleton h-4 w-72 rounded" />
      <div className="mt-7 space-y-3.5">
        <div className="skeleton h-9 w-full rounded-xl" />
        <div className="skeleton h-9 w-full rounded-xl" />
        <div className="skeleton h-9 w-full rounded-xl" />
      </div>
    </div>
  )
}
