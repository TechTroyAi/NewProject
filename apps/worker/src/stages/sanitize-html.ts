/* ══════════════════════════════════════════════════════════════
   Untrusted HTML sanitisation (EPUB / OOXML chapters).

   An EPUB is a zip of HTML documents written by strangers. We hand
   that HTML to LibreOffice to render it into a page image. LibreOffice
   will happily follow `file://` URLs — `<img src="file:///proc/self/
   environ">` would pull the worker's environment (including the
   Supabase service-role key) into the rendered page, and remote URLs
   would turn the worker into an SSRF proxy.

   So the markup is scrubbed before it ever reaches the renderer:
   scripts and embeds go, event handlers go, and every URL that is
   not an inline image or a relative path is removed.

   This is defence in depth. The worker container also runs without
   network access and as an unprivileged user.
   ══════════════════════════════════════════════════════════════ */

/** Elements that are dropped together with their contents. */
const DROP_WITH_CONTENT = [
  'script',
  'noscript',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'base',
  'link',
  'meta',
  'svg',
  'math',
  'template',
]

/** Attributes that carry a URL. */
const URL_ATTRS = ['src', 'href', 'poster', 'background', 'data', 'srcset', 'longdesc', 'usemap', 'formaction']

/** `data:image/…` is fine — it is inline, not a fetch. */
function isSafeUrl(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return false
  if (v.startsWith('data:image/')) return true
  if (v.startsWith('#')) return true
  // Relative paths only — no scheme, no protocol-relative URL.
  if (v.startsWith('//')) return false
  if (/^[a-z][a-z0-9+.-]*:/.test(v)) return false
  return true
}

function scrubUrlAttributes(html: string): string {
  return html.replace(
    /\s([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g,
    (whole, name: string, _value: string, dq?: string, sq?: string, bare?: string) => {
      const value = dq ?? sq ?? bare ?? ''
      if (URL_ATTRS.includes(name.toLowerCase())) {
        if (!isSafeUrl(value)) return ''
        return whole
      }
      if (/^on/i.test(name)) return ''
      if (name.toLowerCase() === 'style') {
        // `url(...)` inside a style attribute can fetch a remote file.
        if (/url\s*\(/i.test(value)) return ''
        return whole
      }
      return whole
    },
  )
}

/**
 * Remove everything from an untrusted HTML document that could make
 * the renderer reach outside the sandbox.
 */
export function sanitizeUntrustedHtml(html: string): string {
  let out = html

  for (const tag of DROP_WITH_CONTENT) {
    // Paired form.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
    // Self-closing / unpaired form.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }

  out = scrubUrlAttributes(out)

  // `<style>` blocks may pull in remote resources through @import.
  out = out.replace(/@import\s+[^;]+;/gi, '')
  out = out.replace(/url\s*\(\s*['"]?\s*[^)]*\)/gi, 'none')

  return out
}

/** Plain-text extraction used for OCR/embedding of epub chapters. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
