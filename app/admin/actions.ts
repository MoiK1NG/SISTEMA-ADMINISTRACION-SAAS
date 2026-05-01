"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function approveUser(userId: string) {
  const supabase = await createClient()
  
  // Verify admin role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("Unauthorized")
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: true, updated_at: new Date().toISOString() })
    .eq("id", userId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function disapproveUser(userId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("Unauthorized")
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: false, updated_at: new Date().toISOString() })
    .eq("id", userId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("Unauthorized")
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", userId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateUserRole(userId: string, role: "user" | "admin" | "superadmin") {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  // Only superadmins can change roles
  if (!adminProfile || adminProfile.role !== "superadmin") {
    throw new Error("Unauthorized - Only superadmins can change roles")
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function deleteUser(userId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("Unauthorized")
  }

  // Don't allow deleting yourself
  if (userId === user.id) {
    throw new Error("Cannot delete your own account")
  }

  // Delete from profiles (will cascade to memberships etc)
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function assignMembership(
  userId: string,
  planId: string,
  startDate: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("Unauthorized")
  }

  // Get plan details for duration
  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("duration_days")
    .eq("id", planId)
    .single()

  if (planError || !plan) throw new Error("Plan not found")

  // Calculate end date
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + plan.duration_days)

  // Deactivate existing memberships for this user
  await supabase
    .from("memberships")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)

  // Create new membership
  const { error } = await supabase.from("memberships").insert({
    user_id: userId,
    plan_id: planId,
    start_date: startDate,
    end_date: end.toISOString().split("T")[0],
    is_active: true,
  })

  if (error) throw error
  
  revalidatePath("/admin/users")
  revalidatePath("/admin/memberships")
  return { success: true }
}

export async function updateMembership(
  membershipId: string,
  isActive: boolean
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("Unauthorized")
  }

  const { error } = await supabase
    .from("memberships")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", membershipId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  revalidatePath("/admin/memberships")
  return { success: true }
}

export async function assignPortalAccess(userId: string, portalId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("Unauthorized")
  }

  const { error } = await supabase.from("user_portal_access").insert({
    user_id: userId,
    portal_id: portalId,
  })

  if (error && error.code !== "23505") throw error // Ignore duplicate key
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function removePortalAccess(userId: string, portalId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (!adminProfile || adminProfile.role === "user") {
    throw new Error("Unauthorized")
  }

  const { error } = await supabase
    .from("user_portal_access")
    .delete()
    .eq("user_id", userId)
    .eq("portal_id", portalId)

  if (error) throw error
  
  revalidatePath("/admin/users")
  return { success: true }
}
