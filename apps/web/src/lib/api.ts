import 'server-only'
import { NextResponse } from 'next/server'
import { IS_DEMO } from './db'
import { DEMO_USER_ID } from './demo'
import { getUserId } from './session'

/**
 * Require a signed-in user.
 *
 * In demo mode every request is the seeded demo user, so the app stays
 * browsable with no infrastructure. In live mode an anonymous request
 * gets a 401 instead of a half-executed write.
 */
export async function requireUser(): Promise<{ userId: string } | { response: NextResponse }> {
  if (IS_DEMO) return { userId: DEMO_USER_ID }
  const userId = await getUserId()
  if (!userId) {
    return {
      response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }),
    }
  }
  return { userId }
}
