"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { requireClient } from "@/lib/supabase/require-client"
import { COOKIE_VER_COMO } from "@/lib/admin-context"

async function verificarAdmin() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autorizado")

  const { data: perfil } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()

  if (perfil?.role !== "admin" && perfil?.role !== "superadmin") {
    throw new Error("Solo un administrador puede inspeccionar portales de clientes")
  }
  return { supabase, user }
}

/**
 * Activa el modo "ver como cliente": el admin navega los portales con los
 * datos de ese cliente, en sola lectura.
 */
export async function verComoCliente(agenteId: string) {
  const { supabase, user } = await verificarAdmin()

  if (agenteId === user.id) throw new Error("Ese ya es tu propio usuario")

  const { data: cliente } = await supabase
    .from("profiles").select("id, full_name, email").eq("id", agenteId).maybeSingle()

  if (!cliente) throw new Error("Cliente no encontrado")

  ;(await cookies()).set(COOKIE_VER_COMO, cliente.id, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   60 * 60 * 4,   // 4 horas: es una sesión de soporte, no permanente
  })

  await supabase.from("audit_logs").insert({
    admin_id:    user.id,
    action:      "ver_como_cliente",
    entity_type: "user",
    entity_id:   cliente.id,
    entity_name: cliente.full_name || cliente.email,
  })

  revalidatePath("/", "layout")
  return { success: true, cliente }
}

/** Vuelve a los datos propios del admin. */
export async function salirDeVerComo() {
  const { supabase, user } = await verificarAdmin()

  ;(await cookies()).delete(COOKIE_VER_COMO)

  await supabase.from("audit_logs").insert({
    admin_id:    user.id,
    action:      "salir_ver_como",
    entity_type: "user",
    entity_id:   user.id,
  })

  revalidatePath("/", "layout")
  return { success: true }
}
