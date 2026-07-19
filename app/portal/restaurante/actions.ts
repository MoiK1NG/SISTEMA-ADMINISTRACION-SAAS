"use server"

import { revalidatePath } from "next/cache"
import { requireClient } from "@/lib/supabase/require-client"

// ── Mesas ─────────────────────────────────────────────────────────────────────
export async function crearMesa(numero: number, capacidad: number) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("mesas_rest").insert({ agente_id: user.id, numero, capacidad })
  if (error) throw error
  revalidatePath("/portal/restaurante")
}

export async function actualizarEstadoMesa(mesa_id: string, estado: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("mesas_rest").update({ estado }).eq("id", mesa_id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/restaurante")
}

// ── Menú ──────────────────────────────────────────────────────────────────────
export async function crearCategoria(nombre: string, orden: number) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { data, error } = await supabase.from("menu_categorias").insert({ agente_id: user.id, nombre, orden }).select("id").single()
  if (error) throw error
  revalidatePath("/portal/restaurante/menu")
  return data
}

export async function crearMenuItem(data: {
  categoria_id?: string; nombre: string; descripcion?: string; precio: number; disponible: boolean
}) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("menu_items_rest").insert({ agente_id: user.id, ...data })
  if (error) throw error
  revalidatePath("/portal/restaurante/menu")
}

export async function editarMenuItem(id: string, data: {
  nombre: string; descripcion?: string; precio: number; disponible: boolean; categoria_id?: string
}) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("menu_items_rest").update(data).eq("id", id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/restaurante/menu")
}

// ── Órdenes ───────────────────────────────────────────────────────────────────
export async function abrirOrden(mesa_id: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  // Marcar mesa como ocupada
  await supabase.from("mesas_rest").update({ estado: "ocupada" }).eq("id", mesa_id).eq("agente_id", user.id)

  const { data, error } = await supabase
    .from("ordenes_rest")
    .insert({ agente_id: user.id, mesa_id })
    .select("id").single()
  if (error) throw error

  revalidatePath("/portal/restaurante")
  return { orden_id: data.id }
}

export async function agregarItemOrden(orden_id: string, menu_item_id: string, cantidad: number, precio_unitario: number, nota?: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await supabase.from("items_orden_rest").insert({
    orden_id, menu_item_id, cantidad, precio_unitario, nota: nota ?? null
  })
  if (error) throw error
  revalidatePath(`/portal/restaurante/mesa/${orden_id}`)
}

export async function actualizarEstadoItem(item_id: string, estado: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("items_orden_rest").update({ estado }).eq("id", item_id)
  if (error) throw error
  revalidatePath("/portal/restaurante")
}

export async function cerrarOrden(orden_id: string, monto: number, metodo: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error: pagoError } = await supabase.from("pagos_rest").insert({
    orden_id, agente_id: user.id, monto, metodo
  })
  if (pagoError) throw pagoError

  // Actualizar estado — el trigger libera la mesa automáticamente
  const { error } = await supabase.from("ordenes_rest").update({ estado: "pagada" }).eq("id", orden_id).eq("agente_id", user.id)
  if (error) throw error

  revalidatePath("/portal/restaurante")
  revalidatePath(`/portal/restaurante/mesa/${orden_id}`)
  return { success: true }
}

export async function cancelarOrden(orden_id: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("ordenes_rest").update({ estado: "cancelada" }).eq("id", orden_id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/restaurante")
}
