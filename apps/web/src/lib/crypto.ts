// Not `server-only`: this module is a pure crypto utility with no
// database or filesystem access, and it is unit tested directly.
// It still must never reach the browser — it imports node:crypto.
import './env'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/* ══════════════════════════════════════════════════════════════
   Secret storage.

   A user may bring their own provider key. It is encrypted with
   AES-256-GCM before it touches the database, so a dump of the
   database does not hand over working API keys.

   The encryption key lives in the server environment
   (`SHELF_ENCRYPTION_KEY`) and never leaves it. Without it the
   feature is simply unavailable — keys are refused rather than stored
   in the clear.
   ══════════════════════════════════════════════════════════════ */

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

export interface SealedSecret {
  ciphertext: string
  iv: string
  tag: string
}

/**
 * The server's encryption key.
 *
 * Accepts 64 hex characters or a base64 string that decodes to 32
 * bytes. Returns null when it is missing or malformed — callers must
 * refuse to store rather than fall back to plaintext.
 */
export function encryptionKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.SHELF_ENCRYPTION_KEY?.trim()
  if (!raw) return null
  let buf: Buffer
  try {
    buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  } catch {
    return null
  }
  return buf.length === 32 ? buf : null
}

export function encryptionConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return encryptionKey(env) !== null
}

/** Encrypt a secret with AES-256-GCM. */
export function sealSecret(plaintext: string, key: Buffer): SealedSecret {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
}

/**
 * Decrypt a sealed secret.
 *
 * Throws when the ciphertext has been tampered with — the GCM tag
 * check is what makes the stored blob tamper-evident.
 */
export function openSecret(sealed: SealedSecret, key: Buffer): string {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(sealed.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * A short, non-reversible fingerprint of a secret.
 *
 * Shown in the UI so the user can tell *which* key is stored without
 * the key itself ever being displayed.
 */
export function fingerprint(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex').slice(0, 12)
}
