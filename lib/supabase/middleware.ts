import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/auth/error']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is authenticated, check their profile status
  if (user && !isPublicRoute && pathname !== '/') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved, is_active, role')
      .eq('id', user.id)
      .single()

    // If user is not approved and trying to access anything other than /pending
    if (profile && !profile.is_approved && pathname !== '/pending') {
      const url = request.nextUrl.clone()
      url.pathname = '/pending'
      return NextResponse.redirect(url)
    }

    // If user is approved but inactive
    if (profile && profile.is_approved && !profile.is_active && pathname !== '/suspended') {
      const url = request.nextUrl.clone()
      url.pathname = '/suspended'
      return NextResponse.redirect(url)
    }

    // If user is approved and trying to access /pending, redirect to dashboard
    if (profile && profile.is_approved && profile.is_active && pathname === '/pending') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Admin route protection
    if (pathname.startsWith('/admin') && profile?.role === 'user') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // If user is authenticated and on login page, redirect appropriately
  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved, is_active')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    if (profile && !profile.is_approved) {
      url.pathname = '/pending'
    } else if (profile && !profile.is_active) {
      url.pathname = '/suspended'
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
