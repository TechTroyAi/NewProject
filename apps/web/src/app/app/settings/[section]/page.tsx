import { SettingsClient } from '@/components/shell/settings-client'
import { describeAiProvider } from '@shelf/shared'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({ params }: { params: { section: string } }) {
  // The active provider is read from the environment on the server —
  // the client never sees a key.
  const provider = describeAiProvider()
  return <SettingsClient section={params.section} provider={provider} />
}
