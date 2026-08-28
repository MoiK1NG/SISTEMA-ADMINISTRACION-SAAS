import { resolverAgente, type ClienteVisto } from "@/lib/admin-context"
import { requirePortalAccess } from "@/lib/portal-security"

export type RolFarmacia = "dueno" | "regente" | "cajero"

export const ROL_LABEL: Record<RolFarmacia, string> = {
  dueno:   "Dueño",
  regente: "Regente",
  cajero:  "Cajero",
}

export interface Negocio {
  id:        string
  nombre:    string
  nit:       string | null
  direccion: string | null
  telefono:  string | null
}

export interface ContextoFarmacia {
  supabase: Awaited<ReturnType<typeof resolverAgente>>["supabase"]
  /** Usuario cuyos datos se muestran (soporta "ver como cliente"). */
  agenteId: string
  viendoA:  ClienteVisto | null
  negocio:  Negocio | null
  /** Rol del agente dentro del negocio; null si no pertenece a ninguno. */
  rol:      RolFarmacia | null
}

/**
 * Contexto de LECTURA para las páginas del portal de farmacia.
 *
 * Resuelve el negocio y el rol del usuario (o del cliente inspeccionado por
 * un admin en modo "ver como"). Si no pertenece a ningún negocio devuelve
 * negocio null y la página muestra el estado correspondiente.
 */
export async function contextoFarmacia(): Promise<ContextoFarmacia> {
  const { supabase, agenteId, viendoA } = await resolverAgente()

  const { data: miembro } = await supabase
    .from("miembros_negocio")
    .select("rol, negocios(id, nombre, nit, direccion, telefono)")
    .eq("user_id", agenteId)
    .limit(1)
    .maybeSingle()

  const negocioRaw = miembro
    ? (Array.isArray((miembro as any).negocios) ? (miembro as any).negocios[0] : (miembro as any).negocios)
    : null

  return {
    supabase,
    agenteId,
    viendoA,
    negocio: negocioRaw ?? null,
    rol: (miembro?.rol as RolFarmacia) ?? null,
  }
}

/**
 * Puerta de ESCRITURA para las server actions de farmacia.
 *
 * Encadena requirePortalAccess("farmacia") — sesión, cuenta habilitada,
 * portal activo, acceso asignado, membresía vigente (propia o heredada del
 * dueño) y bloqueo del modo "ver como" — y encima verifica el rol dentro
 * del negocio.
 */
export async function requireNegocioAccion(rolesPermitidos: RolFarmacia[]) {
  const { supabase, user } = await requirePortalAccess("farmacia")

  const { data: miembro } = await supabase
    .from("miembros_negocio")
    .select("negocio_id, rol")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!miembro) throw new Error("No perteneces a ningún negocio")

  const rol = miembro.rol as RolFarmacia
  if (!rolesPermitidos.includes(rol)) {
    throw new Error("Tu rol no tiene permiso para esta acción")
  }

  return { supabase, user, negocioId: miembro.negocio_id as string, rol }
}
