import { requireClient } from "@/lib/supabase/require-client"
import { PORTALES } from "./portal-config"
import { PortalNavItems, type OtroPortal } from "./portal-nav-items"

interface Props {
  portal: string
  /** Alto de la cabecera de la página: 16 (h-16) o 14 (h-14, el POS). */
  top?: 14 | 16
  /** El POS usa layout de alto fijo, donde sticky sobra. */
  sticky?: boolean
}

/**
 * Barra de navegación del portal. Componente de servidor: resuelve el rol y
 * los portales a los que el usuario puede entrar, y delega el render.
 *
 * Va en TODAS las páginas del portal para poder moverse entre secciones,
 * saltar a otro negocio o volver al panel de admin sin pasar por el inicio.
 */
export async function PortalNav({ portal, top = 16, sticky = true }: Props) {
  if (!PORTALES[portal]) return null

  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()

  const rol     = profile?.role
  const esAdmin = rol === "admin" || rol === "superadmin"

  // El superadmin puede entrar a cualquier portal activo; el resto, solo a
  // los que tenga asignados.
  let slugs: string[] = []
  if (rol === "superadmin") {
    const { data } = await supabase
      .from("portals").select("slug").eq("is_active", true)
    slugs = (data ?? []).map(p => p.slug)
  } else {
    const { data } = await supabase
      .from("user_portal_access")
      .select("portals(slug, is_active)")
      .eq("user_id", user.id)
    slugs = (data ?? [])
      .map((r: any) => (Array.isArray(r.portals) ? r.portals[0] : r.portals))
      .filter((p: any) => p?.is_active)
      .map((p: any) => p.slug)
  }

  // Solo los que tienen pantallas programadas, excluyendo el actual.
  const otros: OtroPortal[] = slugs
    .filter(s => s !== portal && PORTALES[s])
    .map(s => ({ slug: s, nombre: PORTALES[s].nombre, color: PORTALES[s].color }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

  return (
    <PortalNavItems
      portal={portal}
      top={top}
      sticky={sticky}
      esAdmin={esAdmin}
      otros={otros}
    />
  )
}
