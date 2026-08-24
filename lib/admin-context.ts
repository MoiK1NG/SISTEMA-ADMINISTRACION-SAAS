import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { requireClient } from "@/lib/supabase/require-client"

/** Cookie que guarda el cliente que un admin está inspeccionando. */
export const COOKIE_VER_COMO = "ver_como_agente"

export interface ClienteVisto {
  id:        string
  full_name: string | null
  email:     string
}

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
export async function resolverAgente() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: perfil } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()

  const esAdmin = perfil?.role === "admin" || perfil?.role === "superadmin"
  const propio  = { supabase, user, agenteId: user.id, viendoA: null as ClienteVisto | null, esAdmin }

  if (!esAdmin) return propio

  const objetivo = (await cookies()).get(COOKIE_VER_COMO)?.value
  if (!objetivo || objetivo === user.id) return propio

  const { data: cliente } = await supabase
    .from("profiles").select("id, full_name, email").eq("id", objetivo).maybeSingle()

  if (!cliente) return propio

  return { supabase, user, agenteId: cliente.id, viendoA: cliente as ClienteVisto, esAdmin }
}

/**
 * Igual que resolverAgente pero sin cliente de Supabase, para cuando solo
 * hace falta saber si el modo está activo (por ejemplo en las server actions).
 */
export async function clienteEnObservacion(): Promise<ClienteVisto | null> {
  const { viendoA } = await resolverAgente()
  return viendoA
}
