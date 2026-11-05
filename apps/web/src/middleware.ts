import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

/**
 * Route protection.
 *
 * The application data layer already scopes every query with the
 * caller's session (Row Level Security does the filtering), so this
 * middleware is not a security boundary — it is the door. Without it
 * an unauthenticated visitor lands on an empty shelf instead of the
 * sign-in page.
 *
 * In demo mode there is no session to check, so everything stays
 * browsable.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function middleware(req: NextRequest) {
  // Demo mode — no database, no session, nothing to protect.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return NextResponse.next()

  let res = NextResponse.next({ request: { headers: req.headers } })

  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // Write the refreshed tokens back onto the request so the
        // server components see them, and onto the response so the
        // browser keeps them.
        cookiesToSet.forEach(({ name, value }: CookieToSet) => req.cookies.set(name, value))
        res = NextResponse.next({ request: { headers: req.headers } })
        cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
          res.cookies.set(name, value, options),
        )
      },
    },
  })

  // `getUser()` revalidates the token against the auth server — it
  // does not trust a cookie we could have forged.
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { pathname } = req.nextUrl
  const isAuthed = !!user

  if (pathname.startsWith('/app') && !isAuthed) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  if ((pathname === '/login' || pathname === '/signup') && isAuthed) {
    const url = req.nextUrl.clone()
    url.pathname = '/app'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/app/:path*', '/login', '/signup'],
}
