import { AppShell } from '@/components/shell/app-shell'
import { getNavCounts, getSeriesList, getTagList } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [series, tags, counts] = await Promise.all([
    getSeriesList(),
    getTagList(),
    getNavCounts(),
  ])
  return (
    <AppShell series={series} tags={tags} counts={counts}>
      {children}
    </AppShell>
  )
}
