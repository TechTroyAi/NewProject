import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { SourceBrowser } from '@/components/sources/source-browser'
import { Badge } from '@/components/ui/badge'
import { resolveConnected } from '@/lib/sources-data'

export const dynamic = 'force-dynamic'

/** Percent-decode a route param without throwing on malformed input. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default async function SourcePage({ params }: { params: { key: string } }) {
  // Next.js does not percent-decode dynamic route params, so the
  // source key (`packageName#catalogId`) arrives still encoded.
  const key = safeDecode(params.key)
  const source = await resolveConnected(key)
  if (!source) notFound()

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">
      <Link
        href="/app/sources"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted transition hover:text-fg"
      >
        <ArrowLeft className="size-3.5" /> All sources
      </Link>

      <div className="flex flex-wrap items-center gap-2.5 pb-5">
        <h1 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-.02em]">
          {source.iconPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/sources/icon?path=${encodeURIComponent(source.iconPath)}`}
              alt=""
              className="size-8 rounded-lg object-contain"
            />
          )}
          {source.name}
        </h1>
        <Badge tone="accent">{source.language}</Badge>
        {source.adapter && (
          <Badge tone={source.adapter === 'mangadex' ? 'good' : 'default'}>
            {source.adapter === 'mangadex' ? 'MangaDex API' : 'generic adapter'}
          </Badge>
        )}
        {source.nsfw && <Badge tone="bad">18+</Badge>}
        {source.homeUrl && (
          <a
            href={source.homeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11.5px] text-faint transition hover:text-fg"
          >
            {source.homeUrl.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      <SourceBrowser sourceKey={source.key} sourceName={source.name} language={source.language} />
    </div>
  )
}
