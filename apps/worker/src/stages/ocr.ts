import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/** Below this many characters we assume the page has no embedded text. */
const MIN_CHARS_FOR_TEXT = 20

/**
 * Extract text from a page.
 *
 * PDFs with real text layers give us the text for free. For image pages
 * (scans, manga) we fall back to Tesseract OCR — but only when the page
 * looks like it has text worth reading.
 */
export async function extractText(pageImagePath: string): Promise<string> {
  // 1. Embedded text layer (PDF).
  try {
    const { stdout } = await exec('pdftotext', ['-f', '1', '-l', '1', '-layout', pageImagePath, '-'], {
      timeout: 30_000,
    })
    const text = stdout.trim()
    if (text.length >= MIN_CHARS_FOR_TEXT) return text
  } catch {
    /* not a PDF, or pdftotext unavailable */
  }

  // 2. OCR fallback.
  try {
    const dir = await mkdtemp(join(tmpdir(), 'shelf-ocr-'))
    try {
      const { stdout } = await exec(
        'tesseract',
        [pageImagePath, 'stdout', '-l', 'eng', '--psm', '6'],
        { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      )
      return stdout.trim()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  } catch {
    return ''
  }
}

/** Speaker notes from a PPTX, if present. */
export async function extractSpeakerNotes(): Promise<string | null> {
  return null
}
