import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { ProfilePatchSchema, SettingsPatchSchema } from '../apps/web/src/lib/settings-schema.ts'
import { mergeSettings } from '@shelf/shared'

/* ══════════════════════════════════════════════════════════════
   Profile settings.

   Zod strips unknown keys instead of complaining about them, so a
   group missing from the schema disappears on the way in. The client
   gets a 200, the toast says "saved", and nothing is written. That
   is what happened to the daily token budget.
   ══════════════════════════════════════════════════════════════ */

describe('profile settings schema', () => {
  test('the AI block survives validation', () => {
    const parsed = ProfilePatchSchema.safeParse({
      settings: { ai: { dailyTokenBudget: 50_000 } },
    })
    assert.ok(parsed.success)
    assert.deepEqual(parsed.data.settings?.ai, { dailyTokenBudget: 50_000 })
  })

  test('the quiz block survives validation', () => {
    const parsed = ProfilePatchSchema.safeParse({
      settings: { quiz: { newPerDay: 5, dailyCap: 25, enabled: false } },
    })
    assert.ok(parsed.success)
    assert.deepEqual(parsed.data.settings?.quiz, {
      newPerDay: 5,
      dailyCap: 25,
      enabled: false,
    })
  })

  test('the reader and notes blocks survive validation', () => {
    const parsed = ProfilePatchSchema.safeParse({
      display_name: 'Ada',
      settings: {
        reader: { mode: 'paged', rtl: true, spread: false, scale: 1.5 },
        notes: { dailyFormat: 'YYYY-MM-DD' },
      },
    })
    assert.ok(parsed.success)
    assert.equal(parsed.data.display_name, 'Ada')
    assert.equal(parsed.data.settings?.reader?.mode, 'paged')
    assert.equal(parsed.data.settings?.notes?.dailyFormat, 'YYYY-MM-DD')
  })

  test('a negative budget is rejected', () => {
    const parsed = ProfilePatchSchema.safeParse({ settings: { ai: { dailyTokenBudget: -1 } } })
    assert.equal(parsed.success, false)
  })

  test('a zero budget is allowed — it means "no limit"', () => {
    const parsed = ProfilePatchSchema.safeParse({ settings: { ai: { dailyTokenBudget: 0 } } })
    assert.ok(parsed.success)
    assert.equal(parsed.data.settings?.ai?.dailyTokenBudget, 0)
  })

  test('a daily cap below one is rejected', () => {
    const parsed = ProfilePatchSchema.safeParse({ settings: { quiz: { dailyCap: 0 } } })
    assert.equal(parsed.success, false)
  })

  test('zero new cards per day is allowed', () => {
    const parsed = ProfilePatchSchema.safeParse({ settings: { quiz: { newPerDay: 0 } } })
    assert.ok(parsed.success)
  })

  test('an out-of-range reader scale is rejected', () => {
    const parsed = ProfilePatchSchema.safeParse({ settings: { reader: { scale: 9 } } })
    assert.equal(parsed.success, false)
  })

  test('an unknown mode is rejected', () => {
    const parsed = ProfilePatchSchema.safeParse({ settings: { reader: { mode: 'sideways' } } })
    assert.equal(parsed.success, false)
  })
})

describe('merging a settings patch into the stored blob', () => {
  test('saving the reader does not drop the budget', () => {
    const current = { ai: { dailyTokenBudget: 200_000 }, reader: { mode: 'strip' } }
    const merged = mergeSettings(current, { reader: { mode: 'paged' } })
    assert.equal((merged.ai as { dailyTokenBudget: number }).dailyTokenBudget, 200_000)
    assert.equal((merged.reader as { mode: string }).mode, 'paged')
  })

  test('saving the budget does not drop the reader', () => {
    const current = { reader: { mode: 'strip', rtl: true }, ai: { dailyTokenBudget: 200_000 } }
    const merged = mergeSettings(current, { ai: { dailyTokenBudget: 1_000 } })
    assert.equal((merged.reader as { mode: string }).mode, 'strip')
    assert.equal((merged.ai as { dailyTokenBudget: number }).dailyTokenBudget, 1_000)
  })

  test('an array replaces rather than merges', () => {
    const current = { dashboard: [{ i: 'a', x: 0, y: 0, w: 2, h: 2 }] }
    const merged = mergeSettings(current, { dashboard: [] })
    assert.deepEqual(merged.dashboard, [])
  })

  test('a whole group can be replaced', () => {
    const current = { quiz: { newPerDay: 10, dailyCap: 50, enabled: true } }
    const merged = mergeSettings(current, { quiz: { newPerDay: 3 } })
    // The nested group is merged one level deep, so dailyCap survives.
    assert.deepEqual(merged.quiz, { newPerDay: 3, dailyCap: 50, enabled: true })
  })
})

describe('the settings groups the app reads', () => {
  test('every group the UI writes is in the schema', () => {
    // If one of these is missing, the value is dropped on the way in.
    const parsed = SettingsPatchSchema.safeParse({
      reader: { mode: 'strip' },
      notes: { dailyFormat: 'x' },
      ai: { dailyTokenBudget: 1 },
      quiz: { newPerDay: 1 },
    })
    assert.ok(parsed.success)
    assert.deepEqual(Object.keys(parsed.data ?? {}).sort(), ['ai', 'notes', 'quiz', 'reader'])
  })
})
