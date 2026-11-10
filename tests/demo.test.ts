import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  demoSeries,
  demoItems,
  demoNotes,
  demoLinks,
  demoDecks,
  demoCards,
  demoProgress,
  demoTags,
  demoGraphNodes,
  demoGraphEdges,
} from '../apps/web/src/lib/demo.ts'

/* ══════════════════════════════════════════════════════════════
   The demo shelf.

   The demo mode is what a visitor sees first, so its data has to
   hang together: every link points at something that exists, and
   every tag leads somewhere.
   ══════════════════════════════════════════════════════════════ */

const seriesIds = new Set(demoSeries.map((s) => s.id))
const itemIds = new Set(demoItems.map((i) => i.id))
const noteIds = new Set(demoNotes.map((n) => n.id))
const deckIds = new Set(demoDecks.map((d) => d.id))

describe('the demo shelf', () => {
  test('every item belongs to a real series', () => {
    for (const item of demoItems) {
      if (item.series_id) assert.ok(seriesIds.has(item.series_id), `${item.id} → ${item.series_id}`)
    }
  })

  test('every note is anchored to a real item', () => {
    for (const note of demoNotes) {
      if (note.item_id) assert.ok(itemIds.has(note.item_id), `${note.id} → ${note.item_id}`)
    }
  })

  test('every link points at something that exists', () => {
    for (const link of demoLinks) {
      if (link.from_note) assert.ok(noteIds.has(link.from_note), `from_note ${link.from_note}`)
      if (link.to_note) assert.ok(noteIds.has(link.to_note), `to_note ${link.to_note}`)
      if (link.to_item) assert.ok(itemIds.has(link.to_item), `to_item ${link.to_item}`)
    }
  })

  test('every card belongs to a real deck and source', () => {
    for (const card of demoCards) {
      assert.ok(deckIds.has(card.deck_id), `${card.id} → deck ${card.deck_id}`)
      if (card.source_note) assert.ok(noteIds.has(card.source_note), `${card.id} → note ${card.source_note}`)
      if (card.source_item) assert.ok(itemIds.has(card.source_item), `${card.id} → item ${card.source_item}`)
    }
  })

  test('every progress row is about a real item', () => {
    for (const row of demoProgress) {
      assert.ok(itemIds.has(row.item_id), `progress → ${row.item_id}`)
    }
  })

  test('every graph node and edge exists', () => {
    const nodeIds = new Set(demoGraphNodes.map((n) => n.id))
    for (const node of demoGraphNodes) {
      if (node.kind === 'note') assert.ok(noteIds.has(node.id), `graph node ${node.id}`)
      if (node.kind === 'item') assert.ok(itemIds.has(node.id), `graph node ${node.id}`)
      if (node.kind === 'series') assert.ok(seriesIds.has(node.id), `graph node ${node.id}`)
    }
    for (const edge of demoGraphEdges) {
      assert.ok(nodeIds.has(edge.source), `edge source ${edge.source}`)
      assert.ok(nodeIds.has(edge.target), `edge target ${edge.target}`)
    }
  })

  test('every tag matches at least one item', () => {
    for (const tag of demoTags) {
      const count = demoItems.filter((i) => (i.ai_tags ?? []).includes(tag.name)).length
      assert.ok(count > 0, `tag ${tag.name} matches nothing`)
      assert.equal(count, tag.count, `tag ${tag.name} says ${tag.count}, counted ${count}`)
    }
  })

  test('every multiple-choice card has its answer among the options', () => {
    for (const card of demoCards) {
      if (card.type !== 'mcq' || !card.options?.length) continue
      const answer = (card.answer ?? '').trim().toLowerCase()
      assert.ok(
        card.options.some((o) => (o ?? '').trim().toLowerCase() === answer),
        `card ${card.id}: the answer is not one of the options`,
      )
    }
  })
})
