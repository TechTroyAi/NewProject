/* ══════════════════════════════════════════════════════════════
   Streaming SHA-256 in a Web Worker.

   `crypto.subtle.digest` has no incremental API, so a 300 MB PDF
   would have to sit in memory in one piece. The hashing itself lives
   in `@/lib/sha256` so the tests can check it against Node's crypto.
   ══════════════════════════════════════════════════════════════ */

import { Sha256 } from '@/lib/sha256'

self.onmessage = async (e: MessageEvent<{ id: string; file: File }>) => {
  const { id, file } = e.data
  const sha = new Sha256()
  const CHUNK = 4 * 1024 * 1024

  try {
    let offset = 0
    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK)
      const buf = new Uint8Array(await slice.arrayBuffer())
      sha.absorb(buf)
      offset += CHUNK
      self.postMessage({ id, type: 'progress', progress: offset / file.size })
    }
    self.postMessage({ id, type: 'done', hash: sha.finish() })
  } catch (err) {
    self.postMessage({ id, type: 'error', error: String(err) })
  }
}

export {}
