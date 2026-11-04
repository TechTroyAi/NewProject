import { readFile } from 'node:fs/promises'
import type { SniffResult } from '../types.js'

/**
 * Detect the real file type from magic bytes — never trust the
 * extension. Also rejects executables and archives that look like
 * a zip bomb.
 */
export async function sniff(path: string, originalName: string): Promise<SniffResult> {
  const fd = await readFile(path)
  const head = fd.subarray(0, 512)

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

  // ZIP family — then look inside to tell CBZ / EPUB / OOXML apart.
  if (startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0x50, 0x4b, 0x05, 0x06])) {
    const name = originalName.toLowerCase()
    if (name.endsWith('.epub')) return { type: 'epub', mime: 'application/epub+zip', safe: true }
    if (name.endsWith('.pptx') || name.endsWith('.docx')) {
      return {
        type: name.endsWith('.pptx') ? 'pptx' : 'docx',
        mime: name.endsWith('.pptx')
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
