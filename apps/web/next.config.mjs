import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Shelf is an npm-workspaces monorepo: the canonical `.env` lives at
 * the repository root so the web app, the worker and the CLI all read
 * the same file. Next.js only looks inside `apps/web`, so the root
 * environment is loaded here as well — at build time this is what
 * makes `NEXT_PUBLIC_*` variables available to the client bundle.
 */
const appDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(appDir, '../..')

for (const name of ['.env.local', '.env']) {
  const file = resolve(repoRoot, name)
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shelf/shared', '@shelf/sources'],
  experimental: {
    // server actions body size limit (clip uploads / long notes)
    serverActions: { bodySizeLimit: '4mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
}
export default nextConfig
