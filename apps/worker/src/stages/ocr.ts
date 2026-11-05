import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import AdmZip from 'adm-zip'
import { naturalCompare } from '../util/natural.js'

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
  // The page has already been rasterised to an image by the convert
  // stage, so the only way to get text out of it is OCR. (PDFs get
  // their text layer extracted during conversion, where the original
  // file is still around.)
  try {
    const { stdout } = await exec(
      'tesseract',
      [pageImagePath, 'stdout', '-l', 'eng', '--psm', '6'],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

/**
 * The text layer of a single page of a PDF.
 *
 * Returns an empty string for a scanned PDF, which has no text layer
 * — those pages go through OCR instead.
 */
export async function pdfPageText(pdfPath: string, pageNumber: number): Promise<string> {
  try {
    const { stdout } = await exec(
      'pdftotext',
      ['-f', String(pageNumber), '-l', String(pageNumber), '-layout', pdfPath, '-'],
      { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
    )
    const text = stdout.trim()
    return text.length >= MIN_CHARS_FOR_TEXT ? text : ''
  } catch {
    return ''
  }
}

/**
 * The text layer of every page of a PDF, in one pass.
 *
 * `pdftotext` separates pages with a form feed, so one run replaces
 * one process spawn per page — which matters for a few hundred page
 * documents. An empty array means the extraction failed and the
 * caller should fall back to `pdfPageText`.
 */
export async function pdfPageTexts(pdfPath: string): Promise<string[]> {
  try {
    const { stdout } = await exec(
      'pdftotext',
      ['-layout', pdfPath, '-'],
      { timeout: 180_000, maxBuffer: 64 * 1024 * 1024 },
    )
    if (!stdout) return []
    return stdout.split('\f').map((t) => {
      const trimmed = t.trim()
      return trimmed.length >= MIN_CHARS_FOR_TEXT ? trimmed : ''
    })
  } catch {
    return []
  }
}

/**
 * Speaker notes from a PPTX.
 *
 * PowerPoint keeps them in `ppt/notesSlides/notesSlideN.xml` inside
 * the OOXML package. They are not part of the rendered slides, so
 * they have to be read out of the archive directly.
 */
export function extractSpeakerNotes(pptxPath: string): string {
  try {
    const zip = new AdmZip(pptxPath)
    const notes = zip
      .getEntries()
      .filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(e.entryName))
      .sort((a, b) => naturalCompare(a.entryName, b.entryName))
      .map((e) => e.getData().toString('utf8'))
    if (!notes.length) return ''
    const blocks = notes.map((xml, i) => {
      const text = xml
        .replace(/<a:br\/>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
      return text ? `Slide ${i + 1}: ${text}` : ''
    })
    return blocks.filter(Boolean).join('\n\n')
  } catch {
    return ''
  }
}
