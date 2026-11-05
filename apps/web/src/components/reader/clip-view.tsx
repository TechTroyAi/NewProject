import Link from 'next/link'
import { Scissors } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { mediaUrl } from '@/lib/media'

export interface ClipViewData {
  id: string
  item_id: string
  page_idx: number
  bbox: { x: number; y: number; w: number; h: number }
  note_id: string | null
  image_path: string | null
  width: number | null
  height: number | null
  item_title: string
}

/**
 * A saved clip.
 *
 * The image is the whole page; the clip is a window onto it, placed
 * with the same 0–1 fractions the clip was stored with. The result is
 * the cropped region without a second copy of the image on disk.
 */
export function ClipView({ clip }: { clip: ClipViewData }) {
  const { bbox } = clip
  const src = mediaUrl(clip.image_path)
  // The natural aspect of the page, needed to place the window.
  const aspect = clip.width && clip.height ? clip.height / clip.width : 1.4

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-series/12 text-series">
            <Scissors className="size-3.5" />
          </span>
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{clip.item_title}</p>
          <Badge tone="chapter">p.{clip.page_idx + 1}</Badge>
        </div>

        {src ? (
          <div
            className="relative mt-3 overflow-hidden rounded-lg border border-line/10 bg-raised"
            style={{ width: '100%', aspectRatio: `${bbox.w} / ${bbox.h * aspect}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Clip from page ${clip.page_idx + 1}`}
              className="absolute"
              style={{
                width: `${100 / bbox.w}%`,
                left: `${(-100 * bbox.x) / bbox.w}%`,
                top: `${(-100 * bbox.y) / bbox.h}%`,
              }}
            />
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-faint">The page image is no longer available.</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/app/read/${clip.item_id}?p=${clip.page_idx}`}>
            <span className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline">
              Open the page
            </span>
          </Link>
          {clip.note_id && (
            <Link href={`/app/notes/${clip.note_id}`}>
              <span className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline">
                Open the note
              </span>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
