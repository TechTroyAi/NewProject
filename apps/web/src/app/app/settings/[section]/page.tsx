import { notFound } from 'next/navigation'
import { SettingsClient } from '@/components/shell/settings-client'
import { describeAiProvider } from '@shelf/shared'

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
  return <SettingsClient section={params.section} provider={provider} />
}
