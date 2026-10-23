"use server"

import { revalidatePath } from "next/cache"
import { requireClient } from "@/lib/supabase/require-client"
import type { MembershipStatus } from "@/lib/types"
import { borrarCuenta, crearCuentaConClave, validarClave, validarCorreo } from "@/lib/cuentas"

// Helper para verificar rol de admin
async function verifyAdmin() {
  const supabase = await requireClient()
  if (!supabase) throw new Error("No se pudo conectar a la base de datos")

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autorizado")

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (user as any).id)
    .single()

  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("No tienes permisos de administrador")
  }

  return { supabase, user, adminProfile: adminProfile as any }
}

// Helper para verificar superadmin
/**
 * Un admin crea una cuenta con contraseña inicial: queda aprobada y activa, y
 * al primer ingreso la persona elige su contraseña. Rol "user" para cualquier
 * admin; crear otro admin queda reservado al superadmin (igual que cambiar
 * roles). El acceso a portales y la membresía se asignan como siempre.
 */
export async function crearUsuario(input: {
  nombre: string; email: string; clave: string; rol: "user" | "admin"
}) {
  const { supabase, user, adminProfile } = await verifyAdmin()

  const nombre = (input.nombre ?? "").trim()
  if (!nombre) throw new Error("El nombre es obligatorio")
  const correo = validarCorreo(input.email)
  const clave  = validarClave(input.clave)
  const rol    = input.rol === "admin" ? "admin" : "user"
  if (rol === "admin" && adminProfile.role !== "superadmin") {
    throw new Error("Solo un superadmin puede crear administradores")
  }

  const nuevoId = await crearCuentaConClave({ email: correo, nombre, clave })

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: nombre, role: rol, is_approved: true, is_active: true })
    .eq("id", nuevoId)
  if (error) {
    await borrarCuenta(nuevoId).catch(e => console.error("[crearUsuario] no se pudo deshacer la cuenta", e))
    throw new Error(error.message)
  }

  await logAudit(supabase, user.id, {
    action: "create_user", entity_type: "user", entity_id: nuevoId, entity_name: nombre,
    details: { email: correo, rol },
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { id: nuevoId, nombre, email: correo }
}

/**
 * Corre el mantenimiento diario a mano (botón del panel). Es lo mismo que hace
 * la tarea programada de Vercel; sirve para verificar que funciona sin esperar
 * a la madrugada. La función SQL vuelve a verificar que sea admin.
 */
export async function ejecutarMantenimientoAhora() {
  const { supabase } = await verifyAdmin()
  const { data, error } = await supabase.rpc("ejecutar_mantenimiento_diario")
  if (error) throw new Error(error.message)
  revalidatePath("/admin")
  return data as Record<string, unknown>
}

async function verifySuperAdmin() {
  const { supabase, user, adminProfile } = await verifyAdmin()

  if (!adminProfile || (adminProfile as any).role !== "superadmin") {
    throw new Error("No autorizado - Solo superadmins pueden realizar esta acción")
  }

  return { supabase, user }
}

// ==========================================
// AUDITORÍA
// ==========================================

interface AuditEntry {
  action:       string
  entity_type:  "user" | "membership" | "portal" | "plan" | "negocio"
  entity_id?:   string | null
  entity_name?: string | null
  details?:     Record<string, unknown>
}

// El log nunca debe romper la acción principal: si falla, solo se reporta.
async function logAudit(supabase: any, adminId: string, entry: AuditEntry) {
  const { error } = await supabase.from("audit_logs").insert({
    admin_id:    adminId,
    action:      entry.action,
    entity_type: entry.entity_type,
    entity_id:   entry.entity_id ?? null,
    entity_name: entry.entity_name ?? null,
    details:     entry.details ?? null,
  })
  if (error) console.error("[audit_logs]", error.message)
}

async function nombreUsuario(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles").select("full_name, email").eq("id", userId).maybeSingle()
  return data?.full_name || data?.email || null
}

// ==========================================
// ACCIONES DE USUARIOS
// ==========================================

export async function approveUser(userId: string) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: true })
    .eq("id", userId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "approve_user", entity_type: "user", entity_id: userId,
    entity_name: await nombreUsuario(supabase, userId),
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { success: true }
}

export async function disapproveUser(userId: string) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: false })
    .eq("id", userId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "disapprove_user", entity_type: "user", entity_id: userId,
    entity_name: await nombreUsuario(supabase, userId),
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { success: true }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "toggle_active", entity_type: "user", entity_id: userId,
    entity_name: await nombreUsuario(supabase, userId),
    details: { is_active: isActive },
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { success: true }
}

export async function updateUserRole(userId: string, role: "user" | "admin" | "superadmin") {
  const { supabase, user } = await verifySuperAdmin()

  // Prevenir auto-degradación
  if (userId === user.id && role !== "superadmin") {
    throw new Error("No puedes cambiar tu propio rol de superadmin")
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "update_role", entity_type: "user", entity_id: userId,
    entity_name: await nombreUsuario(supabase, userId),
    details: { role },
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function deleteUser(userId: string) {
  const { supabase, user } = await verifyAdmin()

  // No permitir eliminarse a sí mismo
  if (userId === user.id) {
    throw new Error("No puedes eliminar tu propia cuenta")
  }

  // Capturar el nombre ANTES de borrar
  const nombre = await nombreUsuario(supabase, userId)

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "delete_user", entity_type: "user", entity_id: userId, entity_name: nombre,
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { success: true }
}

// ==========================================
// ACCIONES DE MEMBRESÍAS
// ==========================================

/**
 * Crea la membresía (y vence las activas anteriores del usuario). Sin
 * export: la usan assignMembership y el alta de negocios, que ya verificaron
 * que quien llama es admin.
 */
async function crearMembresia(supabase: any, adminId: string, userId: string, planId: string, startDate: string) {
  // Obtener detalles del plan
  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("name, duration_days")
    .eq("id", planId)
    .single()

  if (planError || !plan) throw new Error("Plan no encontrado")

  // Calcular fecha de fin
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + plan.duration_days)
  const endDate = end.toISOString().split("T")[0]

  // Desactivar membresías existentes
  await supabase
    .from("memberships")
    .update({ status: "expired" as MembershipStatus })
    .eq("user_id", userId)
    .eq("status", "active")

  // Crear nueva membresía
  const { data: nueva, error } = await supabase.from("memberships").insert({
    user_id: userId,
    plan_id: planId,
    start_date: startDate,
    end_date: endDate,
    status: "active" as MembershipStatus,
  }).select("id").single()

  if (error) throw error

  const nombre = await nombreUsuario(supabase, userId)
  await logAudit(supabase, adminId, {
    action: "assign_membership", entity_type: "membership", entity_id: nueva?.id,
    entity_name: nombre ? `${nombre} → ${plan.name}` : plan.name,
    details: { user_id: userId, plan_id: planId, start_date: startDate, end_date: endDate },
  })
  return { id: nueva.id as string, endDate }
}

export async function assignMembership(
  userId: string,
  planId: string,
  startDate: string
) {
  const { supabase, user } = await verifyAdmin()
  await crearMembresia(supabase, user.id, userId, planId, startDate)

  revalidatePath("/admin/users")
  revalidatePath("/admin/memberships")
  revalidatePath("/admin")
  return { success: true }
}

export async function updateMembershipStatus(
  membershipId: string,
  status: MembershipStatus
) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase
    .from("memberships")
    .update({ status })
    .eq("id", membershipId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "update_membership_status", entity_type: "membership", entity_id: membershipId,
    details: { status },
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin/memberships")
  return { success: true }
}

export async function extendMembership(membershipId: string, dias: number) {
  const { supabase, user } = await verifyAdmin()

  if (!Number.isInteger(dias) || dias === 0 || Math.abs(dias) > 3650) {
    throw new Error("Cantidad de días inválida")
  }

  const { data: actual } = await supabase
    .from("memberships")
    .select("end_date, user_id")
    .eq("id", membershipId)
    .maybeSingle()

  if (!actual) throw new Error("Membresía no encontrada")

  // Si ya venció, se extiende desde hoy; si está vigente, desde su vencimiento.
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const vence = new Date(actual.end_date + "T00:00:00")
  const base = vence < hoy ? hoy : vence
  const nuevo = new Date(base)
  nuevo.setDate(nuevo.getDate() + dias)

  const nuevoFin = nuevo.toISOString().split("T")[0]

  const { error } = await supabase
    .from("memberships")
    .update({ end_date: nuevoFin, status: "active" })
    .eq("id", membershipId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "extend_membership", entity_type: "membership", entity_id: membershipId,
    entity_name: await nombreUsuario(supabase, actual.user_id),
    details: { dias, end_date: nuevoFin },
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin/memberships")
  revalidatePath("/admin")
  return { success: true, end_date: nuevoFin }
}

export async function deleteMembership(membershipId: string) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "delete_membership", entity_type: "membership", entity_id: membershipId,
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin/memberships")
  return { success: true }
}

// ==========================================
// ACCIONES DE PORTALES
// ==========================================

export async function createPortal(data: {
  name: string
  slug: string
  description: string | null
  url: string | null
  icon: string
  color: string
  is_active: boolean
}) {
  const { supabase, user } = await verifyAdmin()

  // Verificar slug único
  const { data: existing } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", data.slug)
    .single()

  if (existing) {
    throw new Error("Ya existe un portal con este slug")
  }

  const { data: portal, error } = await supabase
    .from("portals").insert(data).select("id").single()

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "create_portal", entity_type: "portal", entity_id: portal?.id,
    entity_name: data.name, details: { slug: data.slug },
  })

  revalidatePath("/admin/portals")
  revalidatePath("/admin")
  return { success: true }
}

export async function updatePortal(
  portalId: string,
  data: {
    name: string
    slug: string
    description: string | null
    url: string | null
    icon: string
    color: string
    is_active: boolean
  }
) {
  const { supabase, user } = await verifyAdmin()

  // Verificar slug único (excluyendo el portal actual)
  const { data: existing } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", data.slug)
    .neq("id", portalId)
    .single()

  if (existing) {
    throw new Error("Ya existe un portal con este slug")
  }

  const { error } = await supabase
    .from("portals")
    .update(data)
    .eq("id", portalId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "update_portal", entity_type: "portal", entity_id: portalId,
    entity_name: data.name, details: { slug: data.slug, is_active: data.is_active },
  })

  revalidatePath("/admin/portals")
  revalidatePath("/admin")
  return { success: true }
}

export async function deletePortal(portalId: string) {
  const { supabase, user } = await verifyAdmin()

  // Capturar el nombre ANTES de borrar
  const { data: portal } = await supabase
    .from("portals").select("name").eq("id", portalId).maybeSingle()

  // Primero eliminar los accesos asociados
  await supabase
    .from("user_portal_access")
    .delete()
    .eq("portal_id", portalId)

  const { error } = await supabase
    .from("portals")
    .delete()
    .eq("id", portalId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "delete_portal", entity_type: "portal", entity_id: portalId,
    entity_name: portal?.name ?? null,
  })

  revalidatePath("/admin/portals")
  revalidatePath("/admin")
  return { success: true }
}

export async function togglePortalActive(portalId: string, isActive: boolean) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase
    .from("portals")
    .update({ is_active: isActive })
    .eq("id", portalId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "toggle_portal", entity_type: "portal", entity_id: portalId,
    details: { is_active: isActive },
  })

  revalidatePath("/admin/portals")
  revalidatePath("/admin")
  return { success: true }
}

// ==========================================
// ACCIONES DE ACCESO A PORTALES
// ==========================================

export async function getUserPortalAccess(userId: string) {
  const { supabase } = await verifyAdmin()

  const { data, error } = await supabase
    .from("user_portal_access")
    .select("portal_id")
    .eq("user_id", userId)

  if (error) throw error

  return data || []
}

export async function updateUserPortalAccess(userId: string, portalIds: string[]) {
  const { supabase, user } = await verifyAdmin()

  // Eliminar todos los accesos existentes
  await supabase
    .from("user_portal_access")
    .delete()
    .eq("user_id", userId)

  // Crear nuevos accesos
  if (portalIds.length > 0) {
    const accesses = portalIds.map((portalId) => ({
      user_id: userId,
      portal_id: portalId,
      granted_by: user.id,
    }))

    const { error } = await supabase.from("user_portal_access").insert(accesses)
    if (error) throw error
  }

  await logAudit(supabase, user.id, {
    action: "update_access", entity_type: "user", entity_id: userId,
    entity_name: await nombreUsuario(supabase, userId),
    details: { portal_ids: portalIds },
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { success: true }
}

export async function assignPortalAccess(userId: string, portalId: string) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase.from("user_portal_access").insert({
    user_id: userId,
    portal_id: portalId,
    granted_by: user.id,
  })

  if (error && error.code !== "23505") throw error // Ignorar duplicados

  if (!error) {
    const { data: portal } = await supabase
      .from("portals").select("name").eq("id", portalId).maybeSingle()
    await logAudit(supabase, user.id, {
      action: "grant_access", entity_type: "user", entity_id: userId,
      entity_name: await nombreUsuario(supabase, userId),
      details: { portal_id: portalId, portal: portal?.name },
    })
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function removePortalAccess(userId: string, portalId: string) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase
    .from("user_portal_access")
    .delete()
    .eq("user_id", userId)
    .eq("portal_id", portalId)

  if (error) throw error

  const { data: portal } = await supabase
    .from("portals").select("name").eq("id", portalId).maybeSingle()
  await logAudit(supabase, user.id, {
    action: "revoke_access", entity_type: "user", entity_id: userId,
    entity_name: await nombreUsuario(supabase, userId),
    details: { portal_id: portalId, portal: portal?.name },
  })

  revalidatePath("/admin/users")
  return { success: true }
}

// ==========================================
// ACCIONES DE PLANES DE MEMBRESÍA
// ==========================================

/** Límite de usuarios por rol: entero >= 0, o null = sin límite. */
function limiteValido(n: unknown, label: string): number | null {
  if (n === null || n === undefined || n === "") return null
  const v = Number(n)
  if (!Number.isInteger(v) || v < 0 || v > 999) throw new Error(`El máximo de ${label} no es válido`)
  return v
}

export async function createMembershipPlan(data: {
  name: string
  description: string | null
  duration_days: number
  price: number
  is_active: boolean
  max_regentes: number | null
  max_cajeros: number | null
}) {
  const { supabase, user } = await verifyAdmin()
  data = { ...data, max_regentes: limiteValido(data.max_regentes, "regentes"), max_cajeros: limiteValido(data.max_cajeros, "cajeros") }

  const { data: plan, error } = await supabase
    .from("membership_plans").insert(data).select("id").single()

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "create_plan", entity_type: "plan", entity_id: plan?.id,
    entity_name: data.name, details: { price: data.price, duration_days: data.duration_days },
  })

  revalidatePath("/admin/memberships")
  return { success: true }
}

export async function updateMembershipPlan(
  planId: string,
  data: {
    name: string
    description: string | null
    duration_days: number
    price: number
    is_active: boolean
    max_regentes: number | null
    max_cajeros: number | null
  }
) {
  const { supabase, user } = await verifyAdmin()
  data = { ...data, max_regentes: limiteValido(data.max_regentes, "regentes"), max_cajeros: limiteValido(data.max_cajeros, "cajeros") }

  const { error } = await supabase
    .from("membership_plans")
    .update(data)
    .eq("id", planId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "update_plan", entity_type: "plan", entity_id: planId,
    entity_name: data.name, details: {
      price: data.price, duration_days: data.duration_days, is_active: data.is_active,
      max_regentes: data.max_regentes, max_cajeros: data.max_cajeros,
    },
  })

  revalidatePath("/admin/memberships")
  return { success: true }
}

export async function deleteMembershipPlan(planId: string) {
  const { supabase, user } = await verifyAdmin()

  // Verificar que no hay membresías activas con este plan
  const { data: activeMemberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("plan_id", planId)
    .eq("status", "active")
    .limit(1)

  if (activeMemberships && activeMemberships.length > 0) {
    throw new Error("No se puede eliminar un plan con membresías activas")
  }

  // Capturar el nombre ANTES de borrar
  const { data: plan } = await supabase
    .from("membership_plans").select("name").eq("id", planId).maybeSingle()

  const { error } = await supabase
    .from("membership_plans")
    .delete()
    .eq("id", planId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "delete_plan", entity_type: "plan", entity_id: planId,
    entity_name: plan?.name ?? null,
  })

  revalidatePath("/admin/memberships")
  return { success: true }
}

// ==========================================
// ALTA DE NEGOCIOS (farmacia)
// ==========================================

interface PersonaAlta { nombre: string; email: string; clave: string }

export interface AltaNegocioInput {
  nombre: string
  moneda: "COP" | "CLP"
  iva:    number
  dueno:  ({ modo: "nueva" } & PersonaAlta) | { modo: "existente"; email: string }
  planId: string
  inicio: string
  equipo: (PersonaAlta & { rol: "regente" | "cajero" })[]
}

/**
 * Da de alta un negocio completo desde el panel: la cuenta del dueño (nueva
 * con contraseña inicial, o una existente), el negocio con su moneda e IVA,
 * el equipo inicial y la membresía del dueño, que heredan todos.
 *
 * Todo o nada: si un paso falla se deshace lo ya creado, en orden inverso.
 * La membresía va al final porque es lo único que no se puede deshacer
 * del todo (vence las membresías activas anteriores de una cuenta existente).
 */
export async function altaNegocioFarmacia(input: AltaNegocioInput) {
  const { supabase, user } = await verifyAdmin()

  // ── Validación completa antes de crear nada ────────────────────────────────
  const nombre = (input.nombre ?? "").trim()
  if (nombre.length < 2) throw new Error("Indica el nombre del negocio")
  if (input.moneda !== "COP" && input.moneda !== "CLP") throw new Error("Moneda inválida")
  const iva = Number(input.iva)
  if (!Number.isFinite(iva) || iva < 0 || iva > 100) throw new Error("IVA inválido")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.inicio ?? "")) throw new Error("Fecha de inicio inválida")

  const { data: plan } = await supabase
    .from("membership_plans").select("id, name, is_active, max_regentes, max_cajeros")
    .eq("id", input.planId).maybeSingle()
  if (!plan) throw new Error("Elige un plan")

  const correoDueno = validarCorreo(input.dueno.email)
  const dueno = input.dueno.modo === "nueva"
    ? { modo: "nueva" as const, nombre: (input.dueno.nombre ?? "").trim(), email: correoDueno, clave: validarClave(input.dueno.clave) }
    : { modo: "existente" as const, email: correoDueno }
  if (dueno.modo === "nueva" && !dueno.nombre) throw new Error("Indica el nombre del dueño")

  const equipo = (input.equipo ?? []).map(p => {
    const n = (p.nombre ?? "").trim()
    if (!n) throw new Error("Falta el nombre de alguien del equipo")
    if (p.rol !== "regente" && p.rol !== "cajero") throw new Error("Rol inválido en el equipo")
    return { nombre: n, email: validarCorreo(p.email), clave: validarClave(p.clave), rol: p.rol }
  })
  const correos = [correoDueno, ...equipo.map(p => p.email)]
  if (new Set(correos).size !== correos.length) throw new Error("Hay correos repetidos entre el dueño y el equipo")

  for (const rol of ["regente", "cajero"] as const) {
    const max = rol === "regente" ? plan.max_regentes : plan.max_cajeros
    const n = equipo.filter(p => p.rol === rol).length
    if (max !== null && max !== undefined && n > max) {
      throw new Error(`El plan ${plan.name} permite hasta ${max} ${rol === "regente" ? "regentes" : "cajeros"}`)
    }
  }

  let duenoId: string
  if (dueno.modo === "existente") {
    const { data: perfil } = await supabase
      // ilike para no depender de mayúsculas; _ y % del correo, escapados
      .from("profiles").select("id").ilike("email", dueno.email.replace(/[\\%_]/g, "\\$&")).maybeSingle()
    if (!perfil) throw new Error("No hay ninguna cuenta con el correo del dueño")
    duenoId = perfil.id
  }

  // ── Creación, con pila para deshacer ───────────────────────────────────────
  const deshacer: (() => Promise<unknown>)[] = []
  try {
    if (dueno.modo === "nueva") {
      duenoId = await crearCuentaConClave({ email: dueno.email, nombre: dueno.nombre, clave: dueno.clave })
      const id = duenoId
      deshacer.push(() => borrarCuenta(id))
    }

    const { data: negocioId, error: errAlta } = await supabase.rpc("alta_negocio_farmacia", {
      p_dueno: duenoId!, p_nombre: nombre, p_moneda: input.moneda, p_iva: iva,
    })
    if (errAlta) throw new Error(errAlta.message)
    deshacer.push(async () => { await supabase.from("negocios").delete().eq("id", negocioId) })

    for (const p of equipo) {
      const id = await crearCuentaConClave({ email: p.email, nombre: p.nombre, clave: p.clave })
      deshacer.push(() => borrarCuenta(id))
      const { error } = await supabase.rpc("agregar_miembro_negocio", {
        p_negocio: negocioId, p_email: p.email, p_rol: p.rol,
      })
      if (error) throw new Error(`${p.nombre}: ${error.message}`)
    }

    const membresia = await crearMembresia(supabase, user.id, duenoId!, plan.id, input.inicio)

    await logAudit(supabase, user.id, {
      action: "alta_negocio", entity_type: "negocio", entity_id: negocioId as string, entity_name: nombre,
      details: {
        moneda: input.moneda, iva, plan: plan.name, vence: membresia.endDate,
        dueno: dueno.email, dueno_nuevo: dueno.modo === "nueva",
        equipo: equipo.map(p => ({ email: p.email, rol: p.rol })),
      },
    })

    revalidatePath("/admin/negocios")
    revalidatePath("/admin/users")
    revalidatePath("/admin")
    return { negocioId: negocioId as string, nombre, vence: membresia.endDate }
  } catch (e: any) {
    for (const paso of deshacer.reverse()) {
      await paso().catch(err => console.error("[altaNegocioFarmacia] no se pudo deshacer un paso", err))
    }
    throw new Error(`${e?.message ?? "Error desconocido"}. Se deshizo lo que se había creado.`)
  }
}
