import { sesionActual } from "@/lib/admin-context"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { PORTALES } from "./portal-config"
import { PortalNavItems, type MarcaNegocio, type OtroPortal } from "./portal-nav-items"

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

  // Misma sesión que ya resolvió la página (memoizada por request)
  const { supabase, user, rol } = await sesionActual()
  if (!user) return null

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

  // Farmacia: logo y color del negocio (contextoFarmacia ya está memoizada
  // por request, la página la resolvió antes)
  let marca: MarcaNegocio | undefined
  if (portal === "farmacia") {
    const { negocio } = await contextoFarmacia()
    if (negocio) marca = { nombre: negocio.nombre, logo: negocio.logo_url, color: negocio.color }
  }

  return (
    <PortalNavItems
      portal={portal}
      top={top}
      sticky={sticky}
      esAdmin={esAdmin}
      otros={otros}
      tutorial={portal === "farmacia"}
      marca={marca}
    />
  )
}
