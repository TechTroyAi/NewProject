import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Shelf is an npm-workspaces monorepo: the canonical `.env` lives at
 * the repository root so the web app, the worker and the CLI all read
 * the same file. Next.js only looks inside `apps/web`, so we read the
 * root file ourselves.
 *
 * Values already present in the environment always win — real
 * deployment config beats a local file. Importing this module has the
 * side effect of loading the file, so it must be imported *before*
 * anything that reads `process.env`.
 */
export function loadRootEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(here, '../../../..')

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
}

loadRootEnv()
