import Link from 'next/link'
import {
  ArrowRight,
  Brain,
  FileText,
  GitBranch,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

const FEATURES = [
  {
    icon: Upload,
    tone: 'rgb(var(--accent))',
    title: 'Drop anything',
    body: 'CBZ, PDF, PPTX, DOCX, EPUB. Folders are walked recursively. Everything becomes pages you can actually read.',
  },
  {
    icon: FileText,
    tone: 'rgb(var(--note))',
    title: 'Notes that link to pages',
    body: 'Markdown with [[wikilinks]]. Write [[Berserk#Ch341 p9]] and it resolves to a deep link straight into the reader.',
  },
  {
    icon: Brain,
    tone: 'rgb(var(--wiki))',
    title: 'An AI that cannot spoil you',
    body: 'Retrieval is filtered by your progress in SQL. Unread pages never reach the model, so it literally cannot leak them.',
  },
  {
    icon: Target,
    tone: 'rgb(var(--series))',
    title: 'Spaced repetition',
    body: 'FSRS schedules cards generated from your own notes. The queue only serves cards from pages you have already passed.',
  },
  {
    icon: GitBranch,
    tone: 'rgb(var(--chapter))',
    title: 'One graph, three node types',
    body: 'Notes, series and chapters live in the same graph. See where your ideas and your reading actually meet.',
  },
  {
    icon: ShieldCheck,
    tone: 'rgb(var(--good))',
    title: 'Private by construction',
    body: 'Row Level Security on every table. Signed URLs with short expiry. Nothing is shared publicly, ever.',
  },
]

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      {/* ambient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(900px 520px at 18% -8%, rgb(var(--accent) / .18), transparent 60%),' +
            'radial-gradient(760px 460px at 82% 6%, rgb(var(--wiki) / .12), transparent 60%),' +
            'radial-gradient(700px 500px at 50% 110%, rgb(var(--series) / .08), transparent 62%)',
        }}
      />
      <div className="grid-paper pointer-events-none absolute inset-0 opacity-[.35]" />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-5">
        {/* nav */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <span
              className="grid size-8 place-items-center rounded-[10px] text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
            >
              <Layers className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Shelf</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/app"
              className="rounded-xl px-3 py-2 text-[13px] text-muted transition hover:bg-raised hover:text-fg"
            >
              Sign in
            </Link>
            <Link href="/app">
              <Button size="sm">
                Open app <ArrowRight />
              </Button>
            </Link>
          </nav>
        </header>

        {/* hero */}
        <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line/10 bg-surface/70 px-3 py-1 text-[11.5px] text-muted backdrop-blur">
            <Sparkles className="size-3 text-accent" />
            Local-first · your files stay yours
          </span>

          <h1 className="mt-6 max-w-3xl text-balance text-[clamp(2.3rem,6vw,4rem)] font-bold leading-[1.05] tracking-[-.03em]">
            A shelf for the things
            <br />
            you <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(120deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
            >
              read
            </span>{' '}
            and{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(120deg, rgb(var(--series)), rgb(var(--chapter)))' }}
            >
              think about
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-[15px] leading-relaxed text-muted">
            Drop a manga chapter, a lecture PDF, a slide deck. Read it, annotate it, link your notes to the exact
            page — and let an AI that can&apos;t spoil you help you remember it.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/app">
              <Button size="lg">
                <Upload /> Start dropping files
              </Button>
            </Link>
            <Link href="/app/library">
              <Button size="lg" variant="secondary">
                Explore the demo shelf
              </Button>
            </Link>
          </div>

          {/* fake drop zone */}
          <div className="mt-16 w-full max-w-2xl rounded-2xl border border-dashed border-line/15 bg-surface/40 p-10 backdrop-blur">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-line/10 bg-raised">
              <Upload className="size-5 text-accent" />
            </div>
            <p className="mt-4 text-[14px] font-semibold">Drop a file anywhere</p>
            <p className="mt-1 text-[12.5px] text-faint">
              Or pick one · CBZ · PDF · PPTX · DOCX · EPUB · folders welcome
            </p>
          </div>
        </section>

        {/* features */}
        <section className="grid gap-3 border-t border-line/8 py-16 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-line/8 bg-surface/50 p-5 transition hover:border-line/15 hover:bg-surface"
            >
              <span
                className="grid size-9 place-items-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${f.tone} 16%, transparent)`, color: f.tone }}
              >
                <f.icon className="size-4" />
              </span>
              <h3 className="mt-3.5 text-[14px] font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-[12.8px] leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </section>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-line/8 py-7 text-[11.5px] text-faint sm:flex-row">
          <p>Shelf — read, think, remember.</p>
          <p className="flex items-center gap-1.5">
            <Lock className="size-3" />
            Upload only what you have the rights to. No public sharing.
          </p>
        </footer>
      </div>
    </div>
  )
}
