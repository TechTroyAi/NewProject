'use client'
import Link from 'next/link'

export const dynamic = 'force-static'

/**
 * The offline page.
 *
 * It is precached by the service worker, so it has to be a static
 * page with no server data — it must render with no network at all.
 */
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
      <div className="max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-accent">Shelf</p>
        <h1 className="mt-3 text-[26px] font-semibold tracking-[-.02em]">You are offline</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          The shelf needs the network to load. Anything you have already read stays on this device — reconnect
          and it will pick up where you left off.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/app"
            className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
          >
            Back to the shelf
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl border border-line/12 px-4 py-2 text-[13px] font-medium text-muted transition hover:text-fg"
          >
            Try again
          </button>
        </div>
        <p className="mt-6 text-[11.5px] text-faint">
          Drafts you are writing are kept locally and will sync when the connection returns.
        </p>
      </div>
    </main>
  )
}
