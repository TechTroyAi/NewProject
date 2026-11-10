import { notFound } from 'next/navigation'
import { SettingsClient } from '@/components/shell/settings-client'
import { describeAiProvider, type ProfileSettings } from '@shelf/shared'
import { getProfile } from '@/lib/data'
import { aiUsageToday } from '@/lib/ai-usage'

export const dynamic = 'force-dynamic'

/** The sections the settings panel knows about. */
const SECTIONS = ['general', 'reader', 'ai', 'quiz', 'data', 'shortcuts'] as const

export default async function SettingsPage({ params }: { params: { section: string } }) {
  // An unknown section used to render an empty page — the nav was
  // there but none of the panels. A 404 is honest.
  if (!SECTIONS.includes(params.section as (typeof SECTIONS)[number])) notFound()

  // The active provider is read from the environment on the server —
  // the client never sees a key.
  const provider = describeAiProvider()
  const profile = await getProfile()
  const settings = (profile?.settings ?? {}) as ProfileSettings
  const usage = await aiUsageToday()
  const used = usage.tokensIn + usage.tokensOut
  return (
    <SettingsClient
      section={params.section}
      provider={provider}
      displayName={profile?.display_name ?? ''}
      dailyFormat={settings.notes?.dailyFormat ?? 'YYYY-MM-DD · daily'}
      reader={settings.reader ?? {}}
      ai={{ dailyTokenBudget: settings.ai?.dailyTokenBudget ?? 200_000 }}
      quiz={{
        newPerDay: settings.quiz?.newPerDay ?? 10,
        dailyCap: settings.quiz?.dailyCap ?? 50,
        enabled: settings.quiz?.enabled !== false,
      }}
      aiUsage={{ used, limit: settings.ai?.dailyTokenBudget ?? 200_000 }}
    />
  )
}
