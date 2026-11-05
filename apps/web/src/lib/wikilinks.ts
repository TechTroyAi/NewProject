import { parseAnchor, parseWikilinks, type ParsedWikilink } from '@shelf/shared'

export type { ParsedWikilink }
export { parseWikilinks, parseAnchor }

export interface ResolvedLink extends ParsedWikilink {
  /** Resolved target id — a note id or item id. */
  href: string
  resolved: boolean
  label: string
}

export interface ItemTarget {
  id: string
  title: string
  seriesTitle?: string | null
  chapter?: number | null
}

export interface NoteTarget {
  id: string
  title: string
}

/**
 * Resolve `[[target]]` against a list of known notes + items.
 *
 * Matching order:
 *   1. exact title (case-insensitive)
 *   2. a series title, disambiguated by the chapter in the anchor
 *   3. note title prefix / contains (Obsidian's fuzzy behaviour)
 *
 * Unresolved links render as "create this note", dimmed.
 */
export function resolveWikilinks(
  md: string,
  opts: {
    notes: NoteTarget[]
    items: ItemTarget[]
    clips?: { id: string; label: string }[]
  },
): ResolvedLink[] {
  const notesByKey = new Map<string, NoteTarget[]>()
  for (const n of opts.notes) {
    const key = n.title.toLowerCase()
    notesByKey.set(key, [...(notesByKey.get(key) ?? []), n])
  }

  const itemsByKey = new Map<string, ItemTarget[]>()
  for (const it of opts.items) {
    for (const key of [it.title.toLowerCase(), it.seriesTitle?.toLowerCase()].filter(Boolean) as string[]) {
      itemsByKey.set(key, [...(itemsByKey.get(key) ?? []), it])
    }
  }

  const byClip = new Map((opts.clips ?? []).map((c) => [c.id.toLowerCase(), c]))

  return parseWikilinks(md).map((link) => {
    const key = link.target.toLowerCase()
    const label = link.alias ?? link.target
    const { chapter, page } = parseAnchor(link.anchor)

    // ── clips ────────────────────────────────────────────────
    if (link.kind === 'clip') {
      const clip = byClip.get(key)
      return {
        ...link,
        href: clip ? `/app/notes?clip=${clip.id}` : '#',
        resolved: !!clip,
        label,
      }
    }

    // ── items ────────────────────────────────────────────────
    const itemCandidates = itemsByKey.get(key)
    if (itemCandidates?.length) {
      // Prefer the item whose chapter matches `[[Series#Ch21]]`.
      const match =
        (chapter !== null
          ? itemCandidates.find(
              (c) => c.chapter === chapter || new RegExp(`\\b(?:c|ch|chapter)\\s*0*${chapter}\\b`, 'i').test(c.title),
            )
          : undefined) ?? itemCandidates[0]
      const q = page !== null ? `?p=${page}` : ''
      return { ...link, kind: 'item' as const, href: `/app/read/${match.id}${q}`, resolved: true, label }
    }

    // ── notes ────────────────────────────────────────────────
    const exact = notesByKey.get(key)
    if (exact?.length) {
      return { ...link, kind: 'note' as const, href: `/app/notes/${exact[0].id}`, resolved: true, label }
    }

    // Fuzzy: a note whose title starts with the target ("Griffith" →
    // "Griffith — the price of the Falcon").
    const fuzzy = opts.notes.find((n) => n.title.toLowerCase().startsWith(key))
    if (fuzzy) {
      return { ...link, kind: 'note' as const, href: `/app/notes/${fuzzy.id}`, resolved: true, label }
    }

    // ── unresolved ───────────────────────────────────────────
    return {
      ...link,
      href: `/app/notes/new?title=${encodeURIComponent(link.target)}`,
      resolved: false,
      label,
    }
  })
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
