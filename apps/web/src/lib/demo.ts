/* ══════════════════════════════════════════════════════════════
   Demo dataset — the app is fully browsable with zero infra.
   Set NEXT_PUBLIC_SUPABASE_URL to switch to the real database.
   ══════════════════════════════════════════════════════════════ */

import type {
  Card,
  GraphEdge,
  GraphNode,
  Item,
  Note,
  Progress,
  Series,
  ShelfLink,
} from '@shelf/shared'

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
export const DEMO_USER_NAME = 'Troy'

const now = Date.now()
const days = (n: number) => new Date(now - n * 86_400_000).toISOString()

/* ─── Series ─────────────────────────────────────────────────── */

export const demoSeries: Series[] = [
  { id: 's-blue-lock', user_id: DEMO_USER_ID, title: 'Blue Lock', cover_path: null, kind: 'manga', created_at: days(220) },
  { id: 's-csm', user_id: DEMO_USER_ID, title: 'Chainsaw Man', cover_path: null, kind: 'manga', created_at: days(400) },
  { id: 's-berserk', user_id: DEMO_USER_ID, title: 'Berserk', cover_path: null, kind: 'manga', created_at: days(600) },
  { id: 's-jjk', user_id: DEMO_USER_ID, title: 'Jujutsu Kaisen', cover_path: null, kind: 'manga', created_at: days(300) },
  { id: 's-distsys', user_id: DEMO_USER_ID, title: 'Distributed Systems', cover_path: null, kind: 'course', created_at: days(90) },
  { id: 's-refui', user_id: DEMO_USER_ID, title: 'Refactoring UI', cover_path: null, kind: 'book', created_at: days(150) },
]

/* ─── Items ──────────────────────────────────────────────────── */

function item(
  id: string,
  series_id: string,
  title: string,
  type: Item['type'],
  chapter: number | null,
  page_count: number,
  opts: Partial<Item> = {},
): Item {
  return {
    id,
    user_id: DEMO_USER_ID,
    series_id,
    type,
    title,
    volume: null,
    chapter,
    file_hash: id.padEnd(64, '0').slice(0, 64),
    original_path: `originals/${DEMO_USER_ID}/${id}.${type}`,
    cover_path: null,
    page_count,
    status: 'ready',
    status_detail: null,
    ai_summary: null,
    ai_tags: [],
    key_terms: [],
    created_at: days(30),
    ...opts,
  }
}

export const demoItems: Item[] = [
  item('i-bl-184', 's-blue-lock', 'Blue Lock v01 c184', 'cbz', 184, 38, {
    ai_summary:
      'Egoist is formally introduced. Sae Itoshi and the Japan U-20 squad arrive for the Neo Egoist League, with Sae watching Rin’s match as a test of whether Japanese strikers can produce anything beyond raw ego.',
    ai_tags: ['egoist', 'sae itoshi', 'neo egoist league'],
    key_terms: [
      { term: 'Egoist', definition: 'A player who pursues their own desire above the team’s, and accepts the consequences.' },
      { term: 'Neo Egoist League', definition: 'U-20 tournament format blending machine learning with striker ego.' },
    ],
  }),
  item('i-bl-185', 's-blue-lock', 'Blue Lock v01 c185', 'cbz', 185, 34, {
    ai_summary: 'Rin scores against a Blue Lock defender, but the match is interrupted by a scheme reveal from the U-20 side.',
    ai_tags: ['rin', 'match'],
  }),
  item('i-bl-186', 's-blue-lock', 'Blue Lock v01 c186', 'cbz', 186, 41, {
    ai_summary: 'The Neo Egoist League format is explained in full. A new character is introduced as a rival to the protagonist.',
    ai_tags: ['neo egoist league', 'format'],
  }),
  item('i-bl-187', 's-blue-lock', 'Blue Lock v01 c187', 'cbz', 187, 36),
  item('i-csm-162', 's-csm', 'Chainsaw Man v02 c162', 'cbz', 162, 22, {
    ai_summary:
      'Denji and the others reach the rescue site. Makima’s smile appears on screen for the first time in the arc, and the team realises the Horsemen are not the only threat.',
    ai_tags: ['makima', 'horsemen', 'arc'],
    key_terms: [
      { term: 'The Smile', definition: 'Makima’s gift — induces an absolute state of devotion in anyone who receives it.' },
    ],
  }),
  item('i-csm-163', 's-csm', 'Chainsaw Man v02 c163', 'cbz', 163, 24),
  item('i-berserk-341', 's-berserk', 'Berserk v22 c341', 'cbz', 341, 30, {
    ai_summary:
      'The Eclipse procession continues. Griffith’s condition is revealed in full — he traded his humanity for the Falcon of Light, and the cost is absolute.',
    ai_tags: ['griffith', 'eclipse', 'falcon of light'],
    key_terms: [{ term: 'Eclipse', definition: 'The ritual event where Griffith achieves apotheosis at the cost of the Band of the Hawk.' }],
  }),
  item('i-berserk-342', 's-berserk', 'Berserk v22 c342', 'cbz', 342, 32),
  item('i-jjk-118', 's-jjk', 'Jujutsu Kaisen v03 c118', 'cbz', 118, 28, {
    ai_summary: 'Yuji fights Sukuna in a rematch. The choreography centres on cursed-energy reinforcement and a technique neither has used before.',
    ai_tags: ['yuji', 'sukuna'],
  }),
  item('i-ds-01', 's-distsys', 'Distributed Systems — Lecture 01', 'pdf', null, 42, {
    type: 'pdf',
    ai_summary: 'Introduction to failure models: crash-stop, omission, timing, and Byzantine faults, and what each model assumes about the network.',
    ai_tags: ['fault-models', 'lecture'],
  }),
  item('i-ds-02', 's-distsys', 'Distributed Systems — Lecture 02', 'pdf', null, 38, { type: 'pdf' }),
  item('i-ds-03', 's-distsys', 'Distributed Systems — Lecture 03', 'pdf', null, 51, { type: 'pdf' }),
  item('i-slides-01', 's-distsys', 'Consensus — Lecture Deck', 'pptx', null, 26, {
    type: 'pptx',
    ai_summary: 'Slide deck covering Paxos, Raft, and practical consensus implementation. Speaker notes included.',
    ai_tags: ['consensus', 'raft'],
  }),
  item('i-refui-01', 's-refui', 'Refactoring UI — Chapter 1', 'pdf', null, 28, {
    type: 'pdf',
    ai_summary: 'Visual hierarchy: size, weight, and colour. Why most interfaces read as cluttered, and the three-question test.',
    ai_tags: ['design', 'hierarchy'],
  }),
  item('i-refui-02', 's-refui', 'Refactoring UI — Chapter 2', 'pdf', null, 24, { type: 'pdf' }),
]

/* ─── Progress ───────────────────────────────────────────────── */

export const demoProgress: Progress[] = [
  { user_id: DEMO_USER_ID, item_id: 'i-bl-184', current_page: 12, max_page_read: 12, percent: 31.6, finished: false, updated_at: days(0) },
  { user_id: DEMO_USER_ID, item_id: 'i-bl-185', current_page: 0, max_page_read: 0, percent: 0, finished: false, updated_at: days(1) },
  { user_id: DEMO_USER_ID, item_id: 'i-csm-162', current_page: 4, max_page_read: 4, percent: 18.2, finished: false, updated_at: days(0) },
  { user_id: DEMO_USER_ID, item_id: 'i-berserk-341', current_page: 9, max_page_read: 9, percent: 30, finished: false, updated_at: days(3) },
  { user_id: DEMO_USER_ID, item_id: 'i-bl-186', current_page: 41, max_page_read: 41, percent: 100, finished: true, updated_at: days(2) },
  { user_id: DEMO_USER_ID, item_id: 'i-bl-183', current_page: 38, max_page_read: 38, percent: 100, finished: true, updated_at: days(4) },
  { user_id: DEMO_USER_ID, item_id: 'i-csm-160', current_page: 22, max_page_read: 22, percent: 100, finished: true, updated_at: days(5) },
  { user_id: DEMO_USER_ID, item_id: 'i-ds-01', current_page: 42, max_page_read: 42, percent: 100, finished: true, updated_at: days(6) },
  { user_id: DEMO_USER_ID, item_id: 'i-ds-02', current_page: 38, max_page_read: 38, percent: 100, finished: true, updated_at: days(6) },
  { user_id: DEMO_USER_ID, item_id: 'i-refui-01', current_page: 28, max_page_read: 28, percent: 100, finished: true, updated_at: days(8) },
  { user_id: DEMO_USER_ID, item_id: 'i-jjk-118', current_page: 28, max_page_read: 28, percent: 100, finished: true, updated_at: days(9) },
]

/* ─── Notes ──────────────────────────────────────────────────── */

export const demoNotes: Note[] = [
  {
    id: 'n-egoist',
    user_id: DEMO_USER_ID,
    title: 'Egoist awakening — panel breakdown',
    body_md: `# Egoist awakening

The moment in [[Blue Lock#Ch184 p12]] where Rin finally hears the word *egoist* and understands what he already was.

## The panel rhythm

Three beats, each wider than the last:

1. Sae's entrance — crowd noise, no face
2. The word lands — full page, single line of text
3. Rin's eye — the only close-up in the sequence

## Why it works

> The camera tells you what to feel before the dialogue does.

Compare with [[Chainsaw Man#Ch162 p4]] where Makima's smile gets **one panel** and no explanation. Same technique, opposite valence — she is the anti-Rin, someone whose ego is so settled it never needs naming.

The distinction matters for [[Griffith]] too: Griffith's "egoist" moment in [[Berserk#Ch341 p9]] is a mirror, not a copy. He reached the same conclusion and paid for it in a way Rin will not.

## Open questions

- Does the league ever call Rin an egoist to his face?
- Is Sae the intended counterweight or a temporary device?

> [!note] Related
> See also the devil motif thread.`,
    item_id: 'i-bl-184',
    page_ref: 12,
    is_ai_draft: false,
    updated_at: days(0),
    created_at: days(2),
  },
  {
    id: 'n-makima-smile',
    user_id: DEMO_USER_ID,
    title: "Denji's smile vs Makima's smile",
    body_md: `# Denji's smile vs Makima's smile

Two smiles, opposite functions.

Denji smiles because he wants something. Makima smiles because she has already decided what everyone wants.

## Parallel

| | Denji | Makima |
|---|---|---|
| Trigger | desire | manipulation |
| Effect on reader | sympathy | dread |
| Panel budget | many | one |

The economy of [[Chainsaw Man#Ch162 p4]] is the point — she gets a **single panel** and the whole arc tilts. Same technique as [[Blue Lock#Ch184 p12]] where Rin gets a full page, but inverted: what Rin is given, Makima already has.

Cross-links: [[Egoist awakening — panel breakdown]], [[The Smile as a device]].`,
    item_id: 'i-csm-162',
    page_ref: 4,
    is_ai_draft: false,
    updated_at: days(1),
    created_at: days(6),
  },
  {
    id: 'n-gojo',
    user_id: DEMO_USER_ID,
    title: 'Gojo Satoru — character wiki',
    body_md: `# Gojo Satoru

> [!ai] AI-generated draft · 6 sources · review pending

## Who

Six Eyes holder, Limitless technique, and the strongest student at [[Jujutsu Kaisen]].

## Techniques

- **Limitless** — manipulation of space at will
- **Six Eyes** — perceive cursed energy with perfect efficiency

## Why it matters

Gojo's power is deliberately *narratively inconvenient* — the story cannot show his full power without breaking itself. Compare [[Egoist awakening — panel breakdown]] on how authors stage a character's ceiling: Gojo by refusing to use it, Rin by having it used on him.

## Appearances

- [[Jujutsu Kaisen#Ch118 p1]]

*Sources: 6 pages · generated from chapter text and notes.*`,
    item_id: 'i-jjk-118',
    page_ref: 1,
    is_ai_draft: true,
    updated_at: days(1),
    created_at: days(3),
  },
  {
    id: 'n-today',
    user_id: DEMO_USER_ID,
    title: '2026-11-04 · daily',
    body_md: `# 2026-11-04

## Reading

- [[Blue Lock#Ch184 p12]] — Sae Itoshi introduction. The egoist panel rhythm is worth the study.
- [[Chainsaw Man#Ch162 p4]] — Makima's smile.

## Notes

Started [[Egoist awakening — panel breakdown]] off the back of the Sae panel. Want to compare against the Makima beat — see [[Denji's smile vs Makima's smile]].

## Queued

- [ ] Finish ch.184 (p.13 → p.38)
- [ ] Blue Lock ch.185
- [x] Read lecture 03 notes

## AI

Ask: *"compare the two smiles"*.`,
    item_id: null,
    page_ref: null,
    is_ai_draft: false,
    updated_at: days(0),
    created_at: days(0),
  },
  {
    id: 'n-smile-device',
    user_id: DEMO_USER_ID,
    title: 'The Smile as a device',
    body_md: `# The Smile as a device

A recurring close-up used by three authors to signal control.

## The pattern

1. The smile appears
2. The panel count is deliberately low
3. The narration refuses to explain it

Seen in [[Chainsaw Man#Ch162 p4]] (Makima), [[Berserk#Ch341 p9]] (Griffith), and inverted in [[Blue Lock#Ch184 p12]] (Rin, who does not know he is smiling).

## Notes

Low panel budget = high stakes. Every extra panel dilutes it.`,
    item_id: null,
    page_ref: null,
    is_ai_draft: false,
    updated_at: days(2),
    created_at: days(9),
  },
  {
    id: 'n-griffith',
    user_id: DEMO_USER_ID,
    title: 'Griffith — the price of the Falcon',
    body_md: `# Griffith — the price of the Falcon

[[Berserk#Ch341 p9]] is the most expensive panel in the arc.

The trade is explicit and the narration does not soften it: the Band of the Hawk, the city, and Griffith's own humanity, for the Falcon of Light.

## Device

Same as [[The Smile as a device]] — the story never explains it, it just shows it. But where Makima's smile is seductive, Griffith's is *pitying*, and that asymmetry is what makes it worse.

Cross-links: [[Egoist awakening — panel breakdown]], [[Denji's smile vs Makima's smile]].`,
    item_id: 'i-berserk-341',
    page_ref: 9,
    is_ai_draft: false,
    updated_at: days(3),
    created_at: days(14),
  },
  {
    id: 'n-fault-models',
    user_id: DEMO_USER_ID,
    title: 'Fault models — crash-stop vs omission',
    body_md: `# Fault models

From [[Distributed Systems#Lecture 01 p8]]:

- **Crash-stop** — a node halts and never recovers
- **Omission** — a node continues but drops messages
- **Timing** — a message arrives out of order or late
- **Byzantine** — a node behaves arbitrarily, including maliciously

The interesting case is **omission**: indistinguishable from a crash to the rest of the system, but with different recovery implications. You cannot always tell the difference from the outside, which is why timeouts are the workhorse primitive.

## For the quiz

Cards are generated from this note with the spoiler limit at page 8.`,
    item_id: 'i-ds-01',
    page_ref: 8,
    is_ai_draft: false,
    updated_at: days(5),
    created_at: days(20),
  },
  {
    id: 'n-hierarchy',
    user_id: DEMO_USER_ID,
    title: 'Visual hierarchy — the three-question test',
    body_md: `# Visual hierarchy

[[Refactoring UI#Chapter 1 p4]]:

> When you squint at a screen, can you tell what matters?

Three questions:

1. Is everything competing for attention?
2. Is the primary action obvious?
3. Does the eye land in the right order?

Size, weight, and colour are the levers. Most of the time you only need one.

## Applied

I want to apply this to Shelf's own dashboard eventually. Right now the stat row has four tiles competing.`,
    item_id: 'i-refui-01',
    page_ref: 4,
    is_ai_draft: false,
    updated_at: days(8),
    created_at: days(30),
  },
]

/* ─── Links (derived from the notes above) ────────────────────── */

export const demoLinks: ShelfLink[] = [
  { id: 'l1', user_id: DEMO_USER_ID, from_note: 'n-egoist', to_note: null, to_item: 'i-bl-184', to_page: 12, kind: 'wikilink' },
  { id: 'l2', user_id: DEMO_USER_ID, from_note: 'n-egoist', to_note: null, to_item: 'i-csm-162', to_page: 4, kind: 'wikilink' },
  { id: 'l3', user_id: DEMO_USER_ID, from_note: 'n-egoist', to_note: 'n-griffith', to_item: null, to_page: null, kind: 'wikilink' },
  { id: 'l4', user_id: DEMO_USER_ID, from_note: 'n-makima-smile', to_note: 'n-egoist', to_item: null, to_page: null, kind: 'wikilink' },
  { id: 'l5', user_id: DEMO_USER_ID, from_note: 'n-makima-smile', to_note: 'n-smile-device', to_item: null, to_page: null, kind: 'wikilink' },
  { id: 'l6', user_id: DEMO_USER_ID, from_note: 'n-smile-device', to_note: null, to_item: 'i-csm-162', to_page: 4, kind: 'wikilink' },
  { id: 'l7', user_id: DEMO_USER_ID, from_note: 'n-smile-device', to_note: null, to_item: 'i-berserk-341', to_page: 9, kind: 'wikilink' },
  { id: 'l8', user_id: DEMO_USER_ID, from_note: 'n-smile-device', to_note: null, to_item: 'i-bl-184', to_page: 12, kind: 'wikilink' },
  { id: 'l9', user_id: DEMO_USER_ID, from_note: 'n-griffith', to_note: 'n-smile-device', to_item: null, to_page: null, kind: 'wikilink' },
  { id: 'l10', user_id: DEMO_USER_ID, from_note: 'n-griffith', to_note: 'n-egoist', to_item: null, to_page: null, kind: 'wikilink' },
  { id: 'l11', user_id: DEMO_USER_ID, from_note: 'n-gojo', to_note: 'n-egoist', to_item: null, to_page: null, kind: 'wikilink' },
  { id: 'l12', user_id: DEMO_USER_ID, from_note: 'n-today', to_note: 'n-egoist', to_item: null, to_page: null, kind: 'wikilink' },
  { id: 'l13', user_id: DEMO_USER_ID, from_note: 'n-today', to_note: 'n-makima-smile', to_item: null, to_page: null, kind: 'wikilink' },
  { id: 'l14', user_id: DEMO_USER_ID, from_note: 'n-fault-models', to_note: null, to_item: 'i-ds-01', to_page: 8, kind: 'wikilink' },
  { id: 'l15', user_id: DEMO_USER_ID, from_note: 'n-hierarchy', to_note: null, to_item: 'i-refui-01', to_page: 4, kind: 'wikilink' },
  { id: 'l16', user_id: DEMO_USER_ID, from_note: 'n-egoist', to_note: 'n-smile-device', to_item: null, to_page: null, kind: 'ai_suggested' },
]

/* ─── Cards (FSRS) ───────────────────────────────────────────── */

function card(
  id: string,
  deck_id: string,
  type: Card['type'],
  question: string,
  answer: string,
  opts: Partial<Card> = {},
): Card {
  return {
    id,
    user_id: DEMO_USER_ID,
    deck_id,
    source_note: null,
    source_item: null,
    source_page: null,
    spoiler_limit_page: 0,
    type,
    question,
    answer,
    options: null,
    explanation: null,
    status: 'active',
    due: days(0),
    stability: 4,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 3,
    reps: 2,
    lapses: 0,
    learning_steps: 0,
    state: 2,
    last_review: days(1),
    ...opts,
  }
}

export const demoDecks = [
  { id: 'd-faults', user_id: DEMO_USER_ID, title: 'Fault models', item_id: null, note_id: 'n-fault-models' },
  { id: 'd-smile', user_id: DEMO_USER_ID, title: 'The Smile as a device', item_id: null, note_id: 'n-smile-device' },
  { id: 'd-hier', user_id: DEMO_USER_ID, title: 'Visual hierarchy', item_id: null, note_id: 'n-hierarchy' },
]

export const demoCards: Card[] = [
  card('c1', 'd-faults', 'flashcard',
    'Which fault model covers a node that keeps running but silently drops messages?',
    'Omission fault',
    { source_note: 'n-fault-models', source_item: 'i-ds-01', source_page: 8, spoiler_limit_page: 8, due: days(0) }),
  card('c2', 'd-faults', 'mcq',
    'Why is the omission fault hard to distinguish from a crash-stop?',
    'From the outside, a node that drops messages looks identical to one that has halted.',
    {
      options: ['Because they produce identical network traffic', 'Because a silent node is observationally equivalent to a halted one', 'Because both are caused by power loss', 'Because timeouts cannot detect either'],
      source_note: 'n-fault-models', source_item: 'i-ds-01', source_page: 9, spoiler_limit_page: 9, due: days(0),
      explanation: 'Omission is observationally equivalent to crash-stop from the perspective of other nodes.',
    }),
  card('c3', 'd-faults', 'tf',
    'The Byzantine fault model assumes a node behaves arbitrarily, including maliciously.',
    'True',
    { source_note: 'n-fault-models', source_item: 'i-ds-01', source_page: 11, spoiler_limit_page: 11, due: days(0) }),
  card('c4', 'd-faults', 'cloze',
    'A node that halts and never recovers is described as a ___ fault.',
    'crash-stop',
    { source_note: 'n-fault-models', source_item: 'i-ds-01', source_page: 8, spoiler_limit_page: 8, due: days(1) }),
  card('c5', 'd-smile', 'flashcard',
    'Why does the story give Makima only a single panel in Chapter 162?',
    'Low panel budget raises the stakes — every extra panel would dilute the reveal.',
    { source_note: 'n-smile-device', source_item: 'i-csm-162', source_page: 4, spoiler_limit_page: 4, due: days(0) }),
  card('c6', 'd-smile', 'short',
    'What is the inverted use of the smile device in Blue Lock Chapter 184?',
    'Rin does not know he is smiling — the device is used before the character has any awareness of it, unlike Makima or Griffith.',
    { source_note: 'n-smile-device', source_item: 'i-bl-184', source_page: 12, spoiler_limit_page: 12, due: days(0) }),
  card('c7', 'd-hier', 'mcq',
    'Which of these is NOT one of the three levers for visual hierarchy?',
    'Borders',
    {
      options: ['Size', 'Weight', 'Colour', 'Borders', 'Spacing'],
      source_note: 'n-hierarchy', source_item: 'i-refui-01', source_page: 6, spoiler_limit_page: 6, due: days(0),
    }),
  card('c8', 'd-hier', 'flashcard',
    'What does the "squint test" ask?',
    'When you squint at a screen, can you tell what matters?',
    { source_note: 'n-hierarchy', source_item: 'i-refui-01', source_page: 4, spoiler_limit_page: 4, due: days(2) }),
  card('c9', 'd-smile', 'order',
    'Order the three uses of the smile device by when they appear.',
    'Rin (Blue Lock 184) → Griffith (Berserk 341) → Makima (Chainsaw Man 162)',
    { source_note: 'n-smile-device', spoiler_limit_page: 4, due: days(0) }),
  card('c10', 'd-faults', 'flashcard',
    'What primitive does the note say is the workhorse for detecting omission faults?',
    'Timeouts',
    { source_note: 'n-fault-models', source_item: 'i-ds-01', source_page: 14, spoiler_limit_page: 14, due: days(0) }),
]

/* ─── Graph ──────────────────────────────────────────────────── */

export const demoGraphNodes: GraphNode[] = [
  { id: 'n-egoist', kind: 'note', label: 'Egoist awakening', degree: 5 },
  { id: 'n-makima-smile', kind: 'note', label: "Denji's smile", degree: 3 },
  { id: 'n-gojo', kind: 'wiki', label: 'Gojo Satoru', degree: 2 },
  { id: 'n-today', kind: 'note', label: '2026-11-04 · daily', degree: 2 },
  { id: 'n-smile-device', kind: 'note', label: 'The Smile as a device', degree: 4 },
  { id: 'n-griffith', kind: 'note', label: 'Griffith — price of the Falcon', degree: 3 },
  { id: 'n-fault-models', kind: 'note', label: 'Fault models', degree: 2 },
  { id: 'n-hierarchy', kind: 'note', label: 'Visual hierarchy', degree: 1 },
  { id: 'i-bl-184', kind: 'item', label: 'Blue Lock c.184', degree: 4 },
  { id: 'i-csm-162', kind: 'item', label: 'CSM c.162', degree: 4 },
  { id: 'i-berserk-341', kind: 'item', label: 'Berserk c.341', degree: 2 },
  { id: 'i-jjk-118', kind: 'item', label: 'JJK c.118', degree: 1 },
  { id: 'i-ds-01', kind: 'item', label: 'DS Lecture 01', degree: 1 },
  { id: 'i-refui-01', kind: 'item', label: 'Refactoring UI ch.1', degree: 1 },
  { id: 's-blue-lock', kind: 'series', label: 'Blue Lock', degree: 1 },
  { id: 's-csm', kind: 'series', label: 'Chainsaw Man', degree: 1 },
  { id: 's-berserk', kind: 'series', label: 'Berserk', degree: 1 },
  { id: 's-jjk', kind: 'series', label: 'Jujutsu Kaisen', degree: 1 },
  { id: 's-distsys', kind: 'series', label: 'Distributed Systems', degree: 1 },
  { id: 's-refui', kind: 'series', label: 'Refactoring UI', degree: 1 },
]

export const demoGraphEdges: GraphEdge[] = demoLinks
  .filter((l) => l.from_note && (l.to_note || l.to_item))
  .map((l, i) => ({
    source: l.from_note!,
    target: (l.to_note ?? l.to_item)!,
    kind: l.kind,
  }))
  .concat([
    { source: 'i-bl-184', target: 's-blue-lock', kind: 'wikilink' },
    { source: 'i-csm-162', target: 's-csm', kind: 'wikilink' },
    { source: 'i-berserk-341', target: 's-berserk', kind: 'wikilink' },
    { source: 'i-jjk-118', target: 's-jjk', kind: 'wikilink' },
    { source: 'i-ds-01', target: 's-distsys', kind: 'wikilink' },
    { source: 'i-refui-01', target: 's-refui', kind: 'wikilink' },
  ])

/* ─── Daily activity (heatmap) ───────────────────────────────── */

export const demoActivity: { date: string; pages: number; reviews: number }[] = Array.from(
  { length: 119 },
  (_, i) => {
    const d = new Date(now - (118 - i) * 86_400_000)
    const wave = Math.sin(i / 5.2) * 0.5 + 0.5
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 0.55 : 1
    const pages = Math.round(wave * 26 * weekend)
    const reviews = Math.round(wave * 14 * weekend)
    return { date: d.toISOString().slice(0, 10), pages, reviews }
  },
)

/* ─── Inbox (needs review) ──────────────────────────────────── */

export const demoInbox = [
  {
    id: 'ib1',
    title: 'Blue Lock v01 c188',
    type: 'cbz' as const,
    reason: 'No series match found',
    candidates: ['Blue Lock'],
    page_count: 38,
    created_at: days(1),
  },
  {
    id: 'ib2',
    title: 'Lecture 04 — Replication',
    type: 'pdf' as const,
    reason: 'Low-confidence title',
    candidates: ['Distributed Systems', 'Distributed Systems (notes)'],
    page_count: 44,
    created_at: days(2),
  },
  {
    id: 'ib3',
    title: 'scan_2026_11_02',
    type: 'image' as const,
    reason: 'Could not determine type',
    candidates: [],
    page_count: 1,
    created_at: days(4),
  },
]

/* ─── Mock page images ───────────────────────────────────────── */

/**
 * Deterministic SVG "page" so the reader looks alive with zero storage.
 * Real deployments serve signed WebP URLs from R2/Supabase instead.
 */
export function mockPageImage(itemId: string, idx: number, pageCount: number): string {
  const palettes: Record<string, [string, string]> = {
    'i-bl-184': ['#1e3a8a', '#0f172a'],
    'i-bl-185': ['#1e3a8a', '#0f172a'],
    'i-bl-186': ['#1e3a8a', '#0f172a'],
    'i-csm-162': ['#7f1d1d', '#111827'],
    'i-csm-163': ['#7f1d1d', '#111827'],
    'i-berserk-341': ['#3f3f46', '#0a0a0c'],
    'i-berserk-342': ['#3f3f46', '#0a0a0c'],
    'i-jjk-118': ['#4c1d95', '#111827'],
    'i-ds-01': ['#1f2937', '#0b1220'],
    'i-ds-02': ['#1f2937', '#0b1220'],
    'i-ds-03': ['#1f2937', '#0b1220'],
    'i-refui-01': ['#0f766e', '#0b1220'],
    'i-refui-02': ['#0f766e', '#0b1220'],
  }
  const [c1, c2] = palettes[itemId] ?? ['#334155', '#0b1220']
  const isText = itemId.startsWith('i-ds') || itemId.startsWith('i-refui')
  const seed = (itemId.charCodeAt(itemId.length - 1) * 31 + idx * 17) % 100

  const panels = isText
    ? ''
    : Array.from({ length: 3 + (seed % 3) }, (_, p) => {
        const w = 40 + ((seed + p * 13) % 25)
        const h = 18 + ((seed + p * 7) % 14)
        const x = 6 + ((p * 29 + seed) % 42)
        const y = 6 + ((p * 37 + seed * 2) % 70)
        return `<rect x="${x}%" y="${y}%" width="${w}%" height="${h}%" rx="3" fill="rgba(255,255,255,${0.05 + (p % 3) * 0.03})" stroke="rgba(255,255,255,.14)" stroke-width="1"/>`
      }).join('')

  const lines = isText
    ? Array.from({ length: 16 }, (_, l) => {
        const w = 62 + ((seed + l * 11) % 32)
        return `<rect x="10%" y="${9 + l * 5.2}%" width="${w}%" height="1.6%" rx="1" fill="rgba(255,255,255,.28)"/>`
      }).join('')
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1700" viewBox="0 0 1200 1700">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>
<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/><feColorMatrix type="saturate" values="0"/></filter></defs>
<rect width="1200" height="1700" fill="url(#g)"/>
<rect width="1200" height="1700" filter="url(#n)" opacity="0.05"/>
${panels}${lines}
<text x="600" y="1650" text-anchor="middle" font-family="monospace" font-size="26" fill="rgba(255,255,255,.34)">${idx + 1} / ${pageCount}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Cover art for library cards — deterministic gradient + title treatment. */
export function mockCover(title: string, kind: string): string {
  const hue = [...title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const isBook = kind !== 'manga'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
<stop offset="0%" stop-color="hsl(${hue} 62% 42%)"/><stop offset="55%" stop-color="hsl(${(hue + 28) % 360} 48% 24%)"/><stop offset="100%" stop-color="hsl(${(hue + 52) % 360} 40% 12%)"/>
</linearGradient></defs>
<rect width="600" height="900" fill="url(#g)"/>
<circle cx="${120 + (hue % 200)}" cy="${180 + (hue % 120)}" r="150" fill="rgba(255,255,255,.07)"/>
<circle cx="${420 - (hue % 180)}" cy="${620 - (hue % 90)}" r="200" fill="rgba(255,255,255,.05)"/>
<text x="46" y="${isBook ? 430 : 470}" font-family="Georgia,serif" font-size="${title.length > 14 ? 46 : 60}" font-weight="bold" fill="rgba(255,255,255,.95)">${title.length > 16 ? title.slice(0, 15) + '…' : title}</text>
<text x="46" y="${isBook ? 480 : 520}" font-family="monospace" font-size="24" fill="rgba(255,255,255,.55)">${kind.toUpperCase()}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
