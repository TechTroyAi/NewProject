import { z } from 'zod'

/**
 * The shape of a profile-settings patch.
 *
 * This lives on its own — away from the route — because Zod's default
 * behaviour is to *strip* unknown keys. A group that is missing from
 * this schema is silently dropped on the way in, so the client gets
 * a 200 and the value never arrives. That is exactly what happened
 * to the `ai` block: the daily token budget reported "saved" and was
 * never written.
 *
 * Keeping the schema in one place also means the route and the tests
 * check the same thing.
 */

export const ReaderSettingsSchema = z.object({
  mode: z.enum(['strip', 'paged']).optional(),
  rtl: z.boolean().optional(),
  spread: z.boolean().optional(),
  background: z.string().max(40).optional(),
  scale: z.number().min(0.5).max(3).optional(),
})

export const SettingsPatchSchema = z.object({
  reader: ReaderSettingsSchema.optional(),
  notes: z.object({ dailyFormat: z.string().max(80).optional() }).optional(),
  ai: z.object({ dailyTokenBudget: z.number().int().min(0).max(10_000_000).optional() }).optional(),
  quiz: z
    .object({
      newPerDay: z.number().int().min(0).max(500).optional(),
      dailyCap: z.number().int().min(1).max(1000).optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
})

export const ProfilePatchSchema = z.object({
  display_name: z.string().min(1).max(80).optional(),
  settings: SettingsPatchSchema.optional(),
})

export type SettingsPatch = z.infer<typeof SettingsPatchSchema>
