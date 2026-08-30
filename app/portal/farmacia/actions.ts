"use server"

import { revalidatePath } from "next/cache"
import { requireNegocioAccion, type RolFarmacia } from "@/lib/farmacia/contexto"
import { textoRequerido, unoDe } from "@/lib/portal-security"

const ROLES = ["dueno", "regente", "cajero"] as const

async function logEquipo(supabase: any, adminId: string, action: string, detalle: Record<string, unknown>) {
  const { error } = await supabase.from("audit_logs").insert({
    admin_id: adminId, action, entity_type: "user",
    entity_name: detalle.email ?? null, details: detalle,
  })
  if (error) console.error("[audit_logs]", error.message)
}

// ── Gestión del equipo (solo dueño; la función SQL lo re-verifica) ────────────
export async function agregarMiembro(email: string, rol: string) {
  const { supabase, user, negocioId } = await requireNegocioAccion(["dueno"])

  const correo = textoRequerido(email, "correo").toLowerCase()
  const rolValido = unoDe(rol, ROLES, "rol") as RolFarmacia

  const { data, error } = await supabase.rpc("agregar_miembro_negocio", {
    p_negocio: negocioId,
    p_email:   correo,
    p_rol:     rolValido,
  })
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "agregar_miembro", { email: correo, rol: rolValido })

  revalidatePath("/portal/farmacia/equipo")
  revalidatePath("/portal/farmacia")
  return data as { user_id: string; nombre: string; aprobado: boolean }
}

export async function cambiarRolMiembro(miembroId: string, rol: string) {
  const { supabase, user } = await requireNegocioAccion(["dueno"])
  const rolValido = unoDe(rol, ROLES, "rol")

  const { error } = await supabase.rpc("cambiar_rol_miembro", {
    p_miembro: miembroId,
    p_rol:     rolValido,
  })
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "cambiar_rol_miembro", { miembro_id: miembroId, rol: rolValido })

  revalidatePath("/portal/farmacia/equipo")
  return { success: true }
}

export async function quitarMiembro(miembroId: string) {
  const { supabase, user } = await requireNegocioAccion(["dueno"])

  const { error } = await supabase.rpc("quitar_miembro_negocio", { p_miembro: miembroId })
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "quitar_miembro", { miembro_id: miembroId })

  revalidatePath("/portal/farmacia/equipo")
  revalidatePath("/portal/farmacia")
  return { success: true }
}

// ── Datos del negocio (dueño) ─────────────────────────────────────────────────
export async function actualizarNegocio(data: {
  nombre: string; nit?: string; direccion?: string; telefono?: string
}) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno"])

  const { error } = await supabase.from("negocios").update({
    nombre:    textoRequerido(data.nombre, "nombre del negocio"),
    nit:       data.nit?.trim() || null,
    direccion: data.direccion?.trim() || null,
    telefono:  data.telefono?.trim() || null,
  }).eq("id", negocioId)
  if (error) throw error

  revalidatePath("/portal/farmacia")
  return { success: true }
}
