import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** `/app/settings` has no page of its own — the first section does. */
export default function SettingsIndex() {
  redirect('/app/settings/general')
}
