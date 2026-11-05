import DOMPurify from 'isomorphic-dompurify'
import { marked } from 'marked'

/* ══════════════════════════════════════════════════════════════
   HTML sanitisation.

   `marked` does not escape raw HTML: `<img src=x onerror=…>` written
   in a note body comes straight out of the parser and would be
   injected into the page by `dangerouslySetInnerHTML`. Everything
   that reaches the DOM goes through here first.

   `isomorphic-dompurify` resolves to plain `dompurify` in the browser
   (via the package's `browser` field) and to a jsdom-backed build on
   the server, so the same call works during SSR and after hydration.
   ══════════════════════════════════════════════════════════════ */

const ALLOWED_TAGS = [
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'details', 'div', 'em', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark', 'ol', 'p',
  'pre', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'var',
]

const ALLOWED_ATTR = [
  'align', 'alt', 'class', 'colspan', 'dir', 'height', 'href', 'id', 'lang',
  'loading', 'open', 'reversed', 'rowspan', 'src', 'start', 'title', 'type',
  'value', 'width',
]

/** Tags that must never survive, whatever else is allowed. */
const FORBID_TAGS = [
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'link', 'meta', 'base', 'svg', 'math',
  'audio', 'video', 'source', 'track',
]

/**
 * Strip anything unsafe from a fragment of HTML.
 *
 * DOMPurify also removes `javascript:` and `data:` URLs from `href`
 * and `src`, and it drops event-handler attributes such as `onerror`
 * and `onclick`.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR: ['style'],
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: true,
    // Keep `target` from opening a tab that can navigate this one.
    ADD_ATTR: ['target'],
  })
}


/* ══════════════════════════════════════════════════════════════
   Markdown rendering with wikilinks.

   Wikilinks are substituted with opaque placeholders *before*
   marked runs, then swapped for anchors afterwards. That keeps
   marked's own escaping intact and stops us from injecting raw
   HTML into the pipeline. Fenced code blocks are left untouched.
   ══════════════════════════════════════════════════════════════ */

const WIKI_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Render a note body to sanitised HTML.
 *
 * `resolvedMap` is keyed by the *raw* wikilink text, e.g. `[[Blue
 * Lock#Ch184]]`. Unresolved links are dimmed by the caller through
 * `data-resolved="false"`.
 */
export function renderMarkdown(
  body: string,
  resolvedMap: Map<string, { label: string; kind: string; resolved: boolean; href: string }>,
): string {
  const anchors: string[] = []
  const lines = body.split('\n')
  const prepared: string[] = []
  let inCode = false

  // The placeholder has to be something the note cannot contain,
  // otherwise a note that literally writes "zWL0zWL" would have it
  // swapped for a link.
  let token = 'zWL'
  while (body.includes(token)) token = `z${token}`

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode
      prepared.push(line)
      continue
    }
    if (inCode) {
      prepared.push(line)
      continue
    }
    prepared.push(
      line.replace(WIKI_RE, (raw) => {
        const hit = resolvedMap.get(raw)
        const label = escapeHtml(hit?.label ?? raw)
        const kind = hit?.kind ?? 'note'
        const resolved = hit?.resolved ?? false
        const href = escapeHtml(hit?.href ?? '#')
        const idx = anchors.length
        anchors.push(
          `<a href="${href}" class="wikilink" data-resolved="${resolved}" data-target="${kind}">${label}</a>`,
        )
        return `${token}${idx}${token}`
      }),
    )
  }

  let html = marked.parse(prepared.join('\n'), { async: false }) as string
  const placeholder = new RegExp(`${token}(\\d+)${token}`, 'g')
  html = html.replace(placeholder, (_, n: string) => anchors[Number(n)] ?? '')
  // `marked` lets raw HTML through, so sanitise before it reaches
  // `dangerouslySetInnerHTML`.
  return sanitizeHtml(html)
}
