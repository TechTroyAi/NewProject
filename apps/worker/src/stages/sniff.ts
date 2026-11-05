import { open, stat } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import type { SniffResult } from '../types.js'

/**
 * Detect the real file type from magic bytes — never trust the
 * extension. Also rejects executables and archives that look like
 * a zip bomb.
 */

/** Nothing bigger than this is worth converting. */
export const MAX_FILE_BYTES = 512 * 1024 * 1024

/** Read the first `length` bytes of a file without loading all of it. */
export async function readHead(path: string, length = 512): Promise<Buffer> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export async function sniff(path: string, originalName: string): Promise<SniffResult> {
  const info = await stat(path)
  if (info.size > MAX_FILE_BYTES) {
    return {
      type: 'unknown',
      mime: 'application/octet-stream',
      safe: false,
      reason: `File is larger than the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit`,
    }
  }
  if (info.size === 0) {
    return { type: 'unknown', mime: 'application/octet-stream', safe: false, reason: 'File is empty' }
  }

  // Only the head is needed — reading a 500 MB upload into memory just
  // to look at 512 bytes would take the worker down.
  const head = await readHead(path, 512)

  const startsWith = (sig: number[]) => sig.every((b, i) => head[i] === b)

  // Executables and scripts are rejected outright.
  const shebang = head.subarray(0, 2).toString('latin1') === '#!'
  if (shebang || startsWith([0x7f, 0x45, 0x4c, 0x46])) {
    return { type: 'unknown', mime: 'application/octet-stream', safe: false, reason: 'Executable file rejected' }
  }
  if (startsWith([0x4d, 0x5a])) {
    return { type: 'unknown', mime: 'application/octet-stream', safe: false, reason: 'Windows executable rejected' }
  }

  // PDF
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { type: 'pdf', mime: 'application/pdf', safe: true }
  }

  // PNG / JPEG / GIF / WEBP
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return { type: 'image', mime: 'image/png', safe: true }
  if (startsWith([0xff, 0xd8, 0xff])) return { type: 'image', mime: 'image/jpeg', safe: true }
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return { type: 'image', mime: 'image/gif', safe: true }
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { type: 'image', mime: 'image/webp', safe: true }
  }

  // ZIP family. The *contents* decide what it is — the extension is
  // only a hint, and a `.cbz` that is really an EPUB must be handled
  // as an EPUB (and vice versa).
  if (startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0x50, 0x4b, 0x05, 0x06])) {
    const kind = await inspectZipKind(path)
    if (kind === 'epub') return { type: 'epub', mime: 'application/epub+zip', safe: true }
    if (kind === 'pptx') {
      return {
        type: 'pptx',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        safe: true,
      }
    }
    if (kind === 'docx') {
      return {
        type: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        safe: true,
      }
    }
    // Unknown zip layout: fall back to the extension, then treat it as
    // a comic archive.
    const name = originalName.toLowerCase()
    if (name.endsWith('.epub')) return { type: 'epub', mime: 'application/epub+zip', safe: true }
    if (name.endsWith('.pptx')) {
      return {
        type: 'pptx',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        safe: true,
      }
    }
    if (name.endsWith('.docx')) {
      return {
        type: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        safe: true,
      }
    }
    return { type: 'cbz', mime: 'application/vnd.comicbook+zip', safe: true }
  }

  if (head.subarray(0, 5).toString('latin1').toLowerCase() === '<?xml' || startsWith([0xef, 0xbb, 0xbf])) {
    return { type: 'txt', mime: 'text/plain', safe: true }
  }

  return { type: 'unknown', mime: 'application/octet-stream', safe: false, reason: 'Unrecognised file type' }
}

/**
 * Look inside a zip and work out what it really is, from the entry
 * names in its central directory:
 *
 *   mimetype                → EPUB
 *   ppt/presentation.xml    → PowerPoint
 *   word/document.xml       → Word
 */
export function inspectZipKind(path: string): 'epub' | 'pptx' | 'docx' | 'unknown' {
  try {
    const zip = new AdmZip(path)
    const names = zip.getEntries().map((e) => e.entryName.toLowerCase())
    if (names.includes('mimetype')) return 'epub'
    if (names.some((n) => n.startsWith('ppt/') && n.endsWith('.xml'))) return 'pptx'
    if (names.some((n) => n.startsWith('word/') && n.endsWith('.xml'))) return 'docx'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}
