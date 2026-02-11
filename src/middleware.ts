import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/users', '/programs', '/schedules', '/settings', '/nutrition', '/organization']
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged in users away from login page
  if (request.nextUrl.pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Check for expired trial - block access to features (but allow billing page)
  const blockedWhenExpired = ['/users', '/programs', '/schedules', '/settings', '/nutrition', '/organization']
  const isBlockedPath = blockedWhenExpired.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (user && isBlockedPath) {
    // Get user's organization and check trial status
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('subscription_status, trial_ends_at')
        .eq('id', profile.organization_id)
        .single()

      if (org?.subscription_status === 'trialing' && org.trial_ends_at) {
        const trialEnd = new Date(org.trial_ends_at)
        const now = new Date()
        
        if (trialEnd < now) {
          // Trial has expired - redirect to billing
          const url = request.nextUrl.clone()
          url.pathname = '/billing'
          url.searchParams.set('expired', 'true')
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
