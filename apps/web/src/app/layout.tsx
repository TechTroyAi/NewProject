import type { Metadata, Viewport } from 'next'
import { themeScript } from '@/components/shell/theme-provider'
import { Providers } from '@/components/shell/providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Shelf — read, think, remember',
    template: '%s · Shelf',
  },
  description:
    'Drop anything. Read it, take notes, connect them, and remember it. A reading shelf with an AI that respects your progress.',
  applicationName: 'Shelf',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#09090e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="midnight" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
