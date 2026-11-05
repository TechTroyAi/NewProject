import { Compass } from 'lucide-react'
import { CatalogBrowser } from '@/components/sources/catalog-browser'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Sources' }

export default function SourcesPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">
      <div className="pb-5">
        <h1 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-.02em]">
          <Compass className="size-5 text-accent" />
          Public sources
        </h1>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">
          The same extension catalogue Mihon uses — 1,400+ public sources across 150 languages, read live from the{' '}
          <span className="font-mono text-fg/80">keiyoushi/extensions</span> repository. Connect a source to browse
          and import from it; imported chapters become normal shelf items you can read, annotate and quiz.
        </p>
      </div>
      <CatalogBrowser />
    </div>
  )
}
