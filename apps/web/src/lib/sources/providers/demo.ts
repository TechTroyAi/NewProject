import type {
  BrowseOptions,
  RemoteChapter,
  RemoteManga,
  RemotePage,
  SourceAdapter,
  SourceDescriptor,
} from '@shelf/shared'
import { demoItems } from '@/lib/demo'
import { mockCover } from '@/lib/demo'

/* ══════════════════════════════════════════════════════════════
   Offline provider.

   Used when the upstream source cannot be reached (no network, or
   the site is down). It serves a realistic catalogue so the whole
   connect → browse → import flow stays explorable.
   ══════════════════════════════════════════════════════════════ */

const CATALOGUE: RemoteManga[] = [
  {
    id: 'i-bl-184',
    title: 'Blue Lock v01 c184',
    author: 'Kaneshiro Muneyuki',
    description:
      'The Neo Egoist League begins. Sae Itoshi arrives to scout the Japan U-20 squad, and Rin finally hears the word "egoist" used about himself.',
    coverUrl: mockCover('Blue Lock', 'manga'),
    genres: ['sports', 'drama'],
    year: 2022,
  },
  {
    id: 'i-csm-162',
    title: 'Chainsaw Man v02 c162',
    author: 'Fujimoto Tatsuki',
    description:
      'The rescue party reaches the site and Makima appears — one panel, no explanation.',
    coverUrl: mockCover('Chainsaw Man', 'manga'),
    genres: ['action', 'dark fantasy'],
    year: 2018,
  },
  {
    id: 'i-berserk-341',
    title: 'Berserk v22 c341',
    author: 'Kentarou Miura',
    description:
      'The Eclipse procession. Griffith trades everything for the Falcon of Light.',
    coverUrl: mockCover('Berserk', 'manga'),
    genres: ['dark fantasy', 'seinen'],
    year: 1989,
  },
  {
    id: 'i-jjk-119',
    title: 'Jujutsu Kaisen v03 c118',
    author: 'Akutami Gege',
    description: 'Yuji fights Sukuna again, with a technique neither of them has used before.',
    coverUrl: mockCover('Jujutsu Kaisen', 'manga'),
    genres: ['shounen', 'action'],
    year: 2018,
  },
  {
    id: 'demo-ucc-001',
    title: 'A Tale of Two Cities — illustrated edition',
    author: 'Charles Dickens',
    description:
      'Public-domain classic, included as sample content for a first run. London and Paris, revolution and the guillotine.',
    coverUrl: mockCover('A Tale of Two Cities', 'book'),
    genres: ['classic', 'historical'],
    year: 1859,
  },
  {
    id: 'demo-mob-001',
    title: 'Notes on the Interpretation of Manga',
    author: 'Public domain sample',
    description:
      'A public-domain sample deck used to demonstrate how lecture slides behave once imported.',
    coverUrl: mockCover('Lecture Slides', 'slides'),
    genres: ['lecture'],
    year: 2024,
  },
]

export const demoAdapter: SourceAdapter = {
  id: 'mangadex',
  label: 'Offline sample',

  supports() {
    return true
  },

  async browse(_source: SourceDescriptor, opts: BrowseOptions = {}): Promise<RemoteManga[]> {
    const q = (opts.query ?? '').trim().toLowerCase()
    const list = q
      ? CATALOGUE.filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            (m.author ?? '').toLowerCase().includes(q) ||
            m.genres.some((g) => g.includes(q)),
        )
      : CATALOGUE
    return list
  },

  async chapters(_source: SourceDescriptor, mangaId: string): Promise<RemoteChapter[]> {
    const item = demoItems.find((i) => i.id === mangaId) ?? demoItems.find((i) => i.title.includes(mangaId))
    const base = item?.chapter ?? 1
    const count = item?.page_count ?? 24
    const count2 = Math.min(6, Math.max(2, Math.round(count / 8)))
    return Array.from({ length: count2 }, (_, i) => ({
      id: `${mangaId}-ch${base + i}`,
      title: `Chapter ${base + i}`,
      number: base + i,
      volume: item?.volume ?? null,
      publishedAt: null,
      pageCount: count,
    }))
  },

  async pages(_source: SourceDescriptor, chapterId: string): Promise<RemotePage[]> {
    const item = demoItems.find((i) => chapterId.startsWith(i.id))
    const count = item?.page_count ?? 24
    return Array.from({ length: count }, (_, index) => ({
      index,
      url: `/api/mock-page?c=${encodeURIComponent(chapterId)}&i=${index}`,
      width: 1200,
      height: 1700,
    }))
  },
}
