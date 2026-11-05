/* ══════════════════════════════════════════════════════════════
   Media URLs.

   The storage bucket is private. Stored files are served through
   `/api/media`, which checks that the file belongs to the caller and
   redirects to a short-lived signed URL. A deployment that fronts the
   bucket with its own CDN can set NEXT_PUBLIC_MEDIA_BASE_URL and the
   path is used directly instead.
   ══════════════════════════════════════════════════════════════ */

export function mediaUrl(storedPath?: string | null): string | null {
  if (!storedPath) return null
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL
  if (base) return `${base.replace(/\/$/, '')}/${storedPath}`
  return `/api/media?path=${encodeURIComponent(storedPath)}`
}
