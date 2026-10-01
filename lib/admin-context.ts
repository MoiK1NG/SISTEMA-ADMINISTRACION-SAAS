import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { requireClient } from "@/lib/supabase/require-client"

import { COOKIE_VER_COMO } from "@/lib/ver-como"

/** Cookie que guarda el cliente que un admin está inspeccionando. */
export { COOKIE_VER_COMO }

export interface ClienteVisto {
  id:        string
  full_name: string | null
  email:     string
}

/**
 * Usuario autenticado y su rol, una sola vez por request.
 *
 * React.cache la memoiza durante el render: la página y la PortalNav la
 * comparten en vez de ir cada una a Supabase Auth y a profiles.
 * No redirige — la PortalNav solo se oculta si no hay sesión.
 */
export const sesionActual = cache(async () => {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, rol: null as string | null }

  const { data: perfil } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()

  return { supabase, user, rol: (perfil?.role as string | undefined) ?? null }
})

/**
 * Resuelve de quién son los datos que la página debe mostrar.
 *
 * Por defecto son los del usuario autenticado. Si un admin activó el modo
 * "ver como cliente", devuelve el id de ese cliente para que el portal se
 * renderice con su información.
 *
 * La cookie sola no alcanza: el rol se verifica en cada llamada, así que si
 * alguien sin permisos la falsifica, se ignora.
 *
 * El modo es de SOLA LECTURA — requirePortalAccess() rechaza las escrituras
 * mientras está activo, para no crear datos con el dueño equivocado.
 */
export const resolverAgente = cache(async () => {
  const { supabase, user, rol } = await sesionActual()
  if (!user) redirect("/login")

  const esAdmin = rol === "admin" || rol === "superadmin"
  const propio  = { supabase, user, agenteId: user.id, viendoA: null as ClienteVisto | null, esAdmin }

  if (!esAdmin) return propio

  const objetivo = (await cookies()).get(COOKIE_VER_COMO)?.value
  if (!objetivo || objetivo === user.id) return propio

  const { data: cliente } = await supabase
    .from("profiles").select("id, full_name, email").eq("id", objetivo).maybeSingle()

  if (!cliente) return propio

  return { supabase, user, agenteId: cliente.id, viendoA: cliente as ClienteVisto, esAdmin }
})

/**
 * Igual que resolverAgente pero sin cliente de Supabase, para cuando solo
 * hace falta saber si el modo está activo (por ejemplo en las server actions).
 */
export async function clienteEnObservacion(): Promise<ClienteVisto | null> {
  const { viendoA } = await resolverAgente()
  return viendoA
}
