import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ---------------------------------------------------------------------------
// Rutas que nunca requieren autenticación
// ---------------------------------------------------------------------------
// /reset-password es pública a propósito: el usuario llega con una sesión de
// recuperación recién creada y no debe rebotar al login antes de cambiarla.
const PUBLIC_ROUTES = [
  '/', '/login', '/signup', '/forgot-password', '/reset-password',
  '/auth/callback', '/auth/error',
]

// Regex que captura /portal/<slug>  →  grupo 1 = slug
const PORTAL_ROUTE_RE = /^\/portal\/([^/]+)/

// ---------------------------------------------------------------------------
// Códigos de error normalizados para query-param ?error=<code>
// El componente cliente los traduce a mensajes legibles.
// ---------------------------------------------------------------------------
export type PortalErrorCode =
  | 'no_access'       // sin fila en user_portal_access
  | 'membership_expired'  // membresía expirada o inexistente
  | 'portal_inactive' // el portal está desactivado por el admin
  | 'unauthorized'    // sin sesión válida

// ---------------------------------------------------------------------------
// Helper: construye NextResponse de redirección con parámetro de error
// ---------------------------------------------------------------------------
function redirectWithError(
  request: NextRequest,
  destination: string,
  error: PortalErrorCode,
): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = destination
  url.searchParams.set('error', error)
  return NextResponse.redirect(url)
}

// ---------------------------------------------------------------------------
// updateSession
// Encadena tres capas de protección en el middleware:
//   1. Sesión Supabase (refresco de tokens via @supabase/ssr)
//   2. Estado del perfil (aprobado, activo, rol)
//   3. Acceso a portales (slug → portal_id → user_portal_access + membership)
// ---------------------------------------------------------------------------
export async function updateSession(request: NextRequest) {
  // Sin Supabase configurado → acceso libre (útil en CI/CD sin env vars)
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  // --- Inicializar cliente SSR con gestión de cookies ---
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // getUser() valida el JWT con Supabase Auth (no usa la caché local)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublicRoute = PUBLIC_ROUTES.some(
    (r) => pathname === r || (r !== '/' && pathname.startsWith(r)),
  )

  // =========================================================================
  // CAPA 1 – Sin sesión
  // =========================================================================
  if (!user) {
    if (isPublicRoute) return supabaseResponse

    // Ruta de portal sin sesión → error específico
    if (PORTAL_ROUTE_RE.test(pathname)) {
      return redirectWithError(request, '/dashboard', 'unauthorized')
    }

    // Cualquier otra ruta protegida → login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // =========================================================================
  // CAPA 2 – Perfil del usuario (aprobado, activo, rol)
  // Se omite en rutas públicas para no hacer una query innecesaria.
  // =========================================================================
  if (!isPublicRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved, is_active, role')
      .eq('id', user.id)
      .single()

    // Superadmin tiene acceso total — nunca se bloquea ni se redirige
    const isSuperAdmin = profile?.role === 'superadmin'

    if (!isSuperAdmin) {
      if (profile && !profile.is_approved && pathname !== '/pending') {
        const url = request.nextUrl.clone()
        url.pathname = '/pending'
        return NextResponse.redirect(url)
      }

      if (profile && profile.is_approved && !profile.is_active && pathname !== '/suspended') {
        const url = request.nextUrl.clone()
        url.pathname = '/suspended'
        return NextResponse.redirect(url)
      }
    }

    if (profile && profile.is_approved && profile.is_active && pathname === '/pending') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/admin') && profile?.role === 'user') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // =======================================================================
    // CAPA 3 – Acceso a portales  /portal/<slug>
    // Superadmin salta esta verificación — accede a todos los portales
    // =======================================================================
    const portalMatch = pathname.match(PORTAL_ROUTE_RE)

    if (portalMatch && !isSuperAdmin) {
      const slug = portalMatch[1]

      // 3a. Obtener el portal por slug y verificar que esté activo
      const { data: portal } = await supabase
        .from('portals')
        .select('id, is_active')
        .eq('slug', slug)
        .single()

      if (!portal || !portal.is_active) {
        return redirectWithError(request, '/dashboard', 'portal_inactive')
      }

      // 3b. Verificar que el usuario tenga la fila en user_portal_access
      const { data: portalAccess } = await supabase
        .from('user_portal_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('portal_id', portal.id)
        .maybeSingle()

      if (!portalAccess) {
        return redirectWithError(request, '/dashboard', 'no_access')
      }

      // 3c. Membresía vigente: propia, o heredada del dueño del negocio
      // (los empleados de una farmacia no pagan membresía aparte)
      const { data: vigente } = await supabase
        .rpc('tiene_membresia_vigente', { p_user: user.id })

      if (!vigente) {
        return redirectWithError(request, '/dashboard', 'membership_expired')
      }

      // ✅ Todo OK → continuar hacia la página del portal
    }
  }

  // =========================================================================
  // Usuario autenticado en rutas públicas → redirigir a su destino correcto
  // =========================================================================
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
