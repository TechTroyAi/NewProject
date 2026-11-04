import DOMPurify from 'isomorphic-dompurify'

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
