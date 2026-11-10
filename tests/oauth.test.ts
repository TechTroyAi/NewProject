import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  envProviders,
  notConfiguredHint,
  providerLabel,
  visibleProviders,
} from '../apps/web/src/lib/oauth-providers.ts'

/* ══════════════════════════════════════════════════════════════
   OAuth provider gating (pure functions).
   ══════════════════════════════════════════════════════════════ */

describe('providerLabel', () => {
  test('google', () => {
    assert.equal(providerLabel('google'), 'Google')
  })
  test('github', () => {
    assert.equal(providerLabel('github'), 'GitHub')
  })
})

describe('notConfiguredHint', () => {
  test('mentions the provider and what to do', () => {
    const hint = notConfiguredHint('google')
    assert.ok(hint.includes('Google'))
    assert.ok(hint.includes('Supabase'))
    assert.ok(hint.includes('Providers'))
  })
})

describe('envProviders', () => {
  test('defaults to both when unset', () => {
    delete process.env.NEXT_PUBLIC_OAUTH_PROVIDERS
    assert.deepEqual(envProviders(), ['google', 'github'])
  })

  test('parses a single provider', () => {
    process.env.NEXT_PUBLIC_OAUTH_PROVIDERS = 'github'
    assert.deepEqual(envProviders(), ['github'])
  })

  test('parses comma-separated with spaces', () => {
    process.env.NEXT_PUBLIC_OAUTH_PROVIDERS = 'google , github'
    assert.deepEqual(envProviders(), ['google', 'github'])
  })

  test('ignores unknown providers', () => {
    process.env.NEXT_PUBLIC_OAUTH_PROVIDERS = 'google,apple,github'
    assert.deepEqual(envProviders(), ['google', 'github'])
  })
})

describe('runtimeProviders', () => {
  test('returns all false when Supabase URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const result = await visibleProviders()
    // With no URL, runtime returns nothing enabled → nothing visible
    // (env defaults to both, but runtime gates them off).
    assert.deepEqual(result, [])
  })
})
