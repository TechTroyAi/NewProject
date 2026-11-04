import { SettingsClient } from '@/components/shell/settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({ params }: { params: { section: string } }) {
  return <SettingsClient section={params.section} />
}
