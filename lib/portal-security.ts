import { cookies } from "next/headers"
import { requireClient } from "@/lib/supabase/require-client"
import { COOKIE_VER_COMO } from "@/lib/admin-context"

/**
 * Puerta de acceso para server actions de portales.
 *
 * El middleware solo protege URLs (/portal/<slug>); un server action se invoca
 * por POST independiente del path, así que cada action debe verificar por su
 * cuenta: sesión → cuenta habilitada → portal activo → acceso asignado →
 * membresía vigente. El superadmin salta todos los chequeos (igual que el
 * middleware).
 */
export async function requirePortalAccess(slug: string) {
  const sesion = await sesionParaEscritura()
  await verificarAccesoPortal(sesion.supabase, sesion.user.id, slug)
  return sesion
}

type Supabase = Awaited<ReturnType<typeof requireClient>>

/** Sesión autenticada y fuera del modo "ver como". Primer paso de toda escritura. */
export async function sesionParaEscritura() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  // Modo "ver como cliente": es de sola lectura. Si se permitieran las
  // escrituras, los datos se crearían con el agente_id del admin y no del
  // cliente que está inspeccionando. La cookie solo cuenta para admins: si un
  // usuario común hereda una vieja en un equipo compartido, se ignora (igual
  // que en resolverAgente). La consulta extra solo ocurre si hay cookie.
  if ((await cookies()).get(COOKIE_VER_COMO)?.value) {
    const { data: perfil } = await supabase
      .from("profiles").select("role").eq("id", user.id).maybeSingle()
    if (perfil?.role === "admin" || perfil?.role === "superadmin") {
      throw new Error(
        "Estás viendo los datos de un cliente en modo lectura. " +
        "Vuelve a tu cuenta para hacer cambios."
      )
    }
  }

  return { supabase, user }
}

/**
 * Cuenta habilitada → portal activo → acceso asignado → membresía vigente.
 *
 * Las cuatro consultas solo dependen del usuario, así que van en paralelo;
 * los resultados se evalúan en el orden de siempre para que el mensaje de
 * error sea el mismo que cuando iban en serie.
 */
export async function verificarAccesoPortal(supabase: Supabase, userId: string, slug: string) {
  const [{ data: profile }, { data: portal }, { data: access }, { data: vigente }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, is_approved, is_active")
      .eq("id", userId)
      .single(),
    supabase
      .from("portals")
      .select("id, is_active")
      .eq("slug", slug)
      .maybeSingle(),
    supabase
      .from("user_portal_access")
      .select("id, portals!inner(slug)")
      .eq("user_id", userId)
      .eq("portals.slug", slug)
      .maybeSingle(),
    // Vigente si tiene membresía propia O si es empleado de un negocio cuyo
    // dueño la tiene (regente y cajeros de una farmacia no pagan aparte).
    supabase.rpc("tiene_membresia_vigente", { p_user: userId }),
  ])

  if (!profile) throw new Error("Perfil no encontrado")
  if (profile.role === "superadmin") return
  if (!profile.is_approved) throw new Error("Cuenta pendiente de aprobación")
  if (!profile.is_active) throw new Error("Cuenta suspendida")
  if (!portal || !portal.is_active) throw new Error("Portal no disponible")
  if (!access) throw new Error("No tienes acceso a este portal")
  if (!vigente) throw new Error("Membresía expirada o inactiva")
}

// ── Validadores de entrada ────────────────────────────────────────────────────
// Los montos van a columnas NUMERIC(12,2): tope 9.999.999.999,99.

const MONTO_MAX = 9_999_999_999
const ENTERO_MAX = 1_000_000

export function montoValido(n: unknown, label = "monto"): number {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) throw new Error(`El ${label} debe ser mayor a cero`)
  if (v > MONTO_MAX) throw new Error(`El ${label} supera el máximo permitido`)
  return Math.round(v * 100) / 100
}

export function montoNoNegativo(n: unknown, label = "monto"): number {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) throw new Error(`El ${label} no puede ser negativo`)
  if (v > MONTO_MAX) throw new Error(`El ${label} supera el máximo permitido`)
  return Math.round(v * 100) / 100
}

export function enteroPositivo(n: unknown, label = "cantidad"): number {
  const v = Number(n)
  if (!Number.isInteger(v) || v <= 0) throw new Error(`La ${label} debe ser un entero mayor a cero`)
  if (v > ENTERO_MAX) throw new Error(`La ${label} supera el máximo permitido`)
  return v
}

export function enteroNoNegativo(n: unknown, label = "cantidad"): number {
  const v = Number(n)
  if (!Number.isInteger(v) || v < 0) throw new Error(`La ${label} no puede ser negativa`)
  if (v > ENTERO_MAX) throw new Error(`La ${label} supera el máximo permitido`)
  return v
}

export function textoRequerido(s: unknown, label = "campo"): string {
  const v = typeof s === "string" ? s.trim() : ""
  if (!v) throw new Error(`El ${label} es obligatorio`)
  if (v.length > 500) throw new Error(`El ${label} es demasiado largo`)
  return v
}

export function unoDe<T extends string>(valor: unknown, permitidos: readonly T[], label = "valor"): T {
  if (typeof valor !== "string" || !(permitidos as readonly string[]).includes(valor)) {
    throw new Error(`${label} inválido`)
  }
  return valor as T
}
