/* Shelf service worker.
 *
 * The point is a graceful offline state, not a full offline mirror of
 * the user's shelf — pages and API responses are private and
 * short-lived, so they are never written to a cache. Only the shell
 * and the offline page are precached; everything else is
 * network-first with the cache used purely as a fallback.
 */

const VERSION = 'shelf-v1'
const PRECACHE = ['/offline', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

/** Never cache these — they are per-user or time-limited. */
function isPrivate(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/pages/') ||
    pathname.startsWith('/thumbs/') ||
    pathname.startsWith('/originals/') ||
    pathname.startsWith('/_next/webpack-hmr')
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return
  if (isPrivate(url.pathname)) return

  // Navigations: always try the network first so the user sees fresh
  // data, and fall back to the offline page when it is unreachable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match('/offline', { cacheName: VERSION })
          .then((cached) => cached || Response.error()),
      ),
    )
    return
  }

  // Static assets: cache first, then fill the cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(VERSION).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
    }),
  )
})
