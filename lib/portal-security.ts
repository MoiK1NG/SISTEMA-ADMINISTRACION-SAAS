import { requireClient } from "@/lib/supabase/require-client"

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
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved, is_active")
    .eq("id", user.id)
    .single()

  if (!profile) throw new Error("Perfil no encontrado")
  if (profile.role === "superadmin") return { supabase, user }
  if (!profile.is_approved) throw new Error("Cuenta pendiente de aprobación")
  if (!profile.is_active) throw new Error("Cuenta suspendida")

  const { data: portal } = await supabase
    .from("portals")
    .select("id, is_active")
    .eq("slug", slug)
    .maybeSingle()
  if (!portal || !portal.is_active) throw new Error("Portal no disponible")

  const { data: access } = await supabase
    .from("user_portal_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("portal_id", portal.id)
    .maybeSingle()
  if (!access) throw new Error("No tienes acceso a este portal")

  const today = new Date().toISOString().split("T")[0]
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today)
    .limit(1)
    .maybeSingle()
  if (!membership) throw new Error("Membresía expirada o inactiva")

  return { supabase, user }
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
