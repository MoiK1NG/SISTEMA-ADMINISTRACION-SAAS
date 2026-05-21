"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { MembershipStatus } from "@/lib/types"

// Helper para verificar rol de admin
async function verifyAdmin() {
  const supabase = await createClient()
  if (!supabase) throw new Error("No se pudo conectar a la base de datos")
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autorizado")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (user as any).id) // <-- El truco del "as any" aquí calma a TypeScript por completo
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("No tienes permisos de administrador")
  }
  
  return { supabase, user }
}

// Helper para verificar superadmin
async function verifySuperAdmin() {
  const { supabase, user, adminProfile } = await verifyAdmin()
  
  if (adminProfile.role !== "superadmin") {
    throw new Error("No autorizado - Solo superadmins pueden realizar esta acción")
  }

  return { supabase, user, adminProfile }
}

// ==========================================
// ACCIONES DE USUARIOS
// ==========================================

export async function approveUser(userId: string) {
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: true })
    .eq("id", userId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { success: true }
}

export async function disapproveUser(userId: string) {
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: false })
    .eq("id", userId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { success: true }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId)

  if (error) throw error
  
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
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function deleteUser(userId: string) {
  const { supabase, user } = await verifyAdmin()

  // No permitir eliminarse a sí mismo
  if (userId === user.id) {
    throw new Error("No puedes eliminar tu propia cuenta")
  }

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId)

  if (error) throw error
  
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
  const { supabase } = await verifyAdmin()

  // Obtener detalles del plan
  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("duration_days")
    .eq("id", planId)
    .single()

  if (planError || !plan) throw new Error("Plan no encontrado")

  // Calcular fecha de fin
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + plan.duration_days)

  // Desactivar membresías existentes
  await supabase
    .from("memberships")
    .update({ status: "expired" as MembershipStatus })
    .eq("user_id", userId)
    .eq("status", "active")

  // Crear nueva membresía
  const { error } = await supabase.from("memberships").insert({
    user_id: userId,
    plan_id: planId,
    start_date: startDate,
    end_date: end.toISOString().split("T")[0],
    status: "active" as MembershipStatus,
  })

  if (error) throw error
  
  revalidatePath("/admin/users")
  revalidatePath("/admin/memberships")
  revalidatePath("/admin")
  return { success: true }
}

export async function updateMembershipStatus(
  membershipId: string,
  status: MembershipStatus
) {
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from("memberships")
    .update({ status })
    .eq("id", membershipId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  revalidatePath("/admin/memberships")
  return { success: true }
}

export async function deleteMembership(membershipId: string) {
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId)

  if (error) throw error
  
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
  const { supabase } = await verifyAdmin()

  // Verificar slug único
  const { data: existing } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", data.slug)
    .single()

  if (existing) {
    throw new Error("Ya existe un portal con este slug")
  }

  const { error } = await supabase.from("portals").insert(data)

  if (error) throw error
  
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
  const { supabase } = await verifyAdmin()

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
  
  revalidatePath("/admin/portals")
  revalidatePath("/admin")
  return { success: true }
}

export async function deletePortal(portalId: string) {
  const { supabase } = await verifyAdmin()

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
  
  revalidatePath("/admin/portals")
  revalidatePath("/admin")
  return { success: true }
}

export async function togglePortalActive(portalId: string, isActive: boolean) {
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from("portals")
    .update({ is_active: isActive })
    .eq("id", portalId)

  if (error) throw error
  
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
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function removePortalAccess(userId: string, portalId: string) {
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from("user_portal_access")
    .delete()
    .eq("user_id", userId)
    .eq("portal_id", portalId)

  if (error) throw error
  
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
  const { supabase } = await verifyAdmin()

  const { error } = await supabase.from("membership_plans").insert(data)

  if (error) throw error
  
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
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from("membership_plans")
    .update(data)
    .eq("id", planId)

  if (error) throw error
  
  revalidatePath("/admin/memberships")
  return { success: true }
}

export async function deleteMembershipPlan(planId: string) {
  const { supabase } = await verifyAdmin()

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

  const { error } = await supabase
    .from("membership_plans")
    .delete()
    .eq("id", planId)

  if (error) throw error
  
  revalidatePath("/admin/memberships")
  return { success: true }
}
