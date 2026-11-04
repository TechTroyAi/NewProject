import { AppShell } from '@/components/shell/app-shell'
import { getSeriesList } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const series = await getSeriesList()
  return (
    <AppShell series={series}>
      {children}
    </AppShell>
  )
}
