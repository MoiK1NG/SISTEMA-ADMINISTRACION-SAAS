"use server"

import { revalidatePath } from "next/cache"
import { requireClient } from "@/lib/supabase/require-client"
import type { MembershipStatus } from "@/lib/types"

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
  entity_type:  "user" | "membership" | "portal" | "plan"
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

export async function assignMembership(
  userId: string,
  planId: string,
  startDate: string
) {
  const { supabase, user } = await verifyAdmin()

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
  await logAudit(supabase, user.id, {
    action: "assign_membership", entity_type: "membership", entity_id: nueva?.id,
    entity_name: nombre ? `${nombre} → ${plan.name}` : plan.name,
    details: { user_id: userId, plan_id: planId, start_date: startDate, end_date: endDate },
  })

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

export async function createMembershipPlan(data: {
  name: string
  description: string | null
  duration_days: number
  price: number
  is_active: boolean
}) {
  const { supabase, user } = await verifyAdmin()

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
  }
) {
  const { supabase, user } = await verifyAdmin()

  const { error } = await supabase
    .from("membership_plans")
    .update(data)
    .eq("id", planId)

  if (error) throw error

  await logAudit(supabase, user.id, {
    action: "update_plan", entity_type: "plan", entity_id: planId,
    entity_name: data.name, details: { price: data.price, duration_days: data.duration_days, is_active: data.is_active },
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
