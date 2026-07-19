"use server"

import { revalidatePath } from "next/cache"
import { requireClient } from "@/lib/supabase/require-client"

// ── Productos ─────────────────────────────────────────────────────────────────
export async function crearProducto(data: {
  nombre: string; categoria: string; precio_venta: number; costo_produccion: number; unidad: string
}) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("productos_pan").insert({ agente_id: user.id, ...data })
  if (error) throw error
  revalidatePath("/portal/panaderia/productos")
}

export async function editarProducto(id: string, data: {
  nombre: string; categoria: string; precio_venta: number; costo_produccion: number; unidad: string; activo: boolean
}) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("productos_pan").update(data).eq("id", id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/panaderia/productos")
}

// ── Órdenes de producción ─────────────────────────────────────────────────────
export async function crearOrdenProduccion(fecha: string, items: { producto_id: string; cantidad_plan: number }[]) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: orden, error } = await supabase
    .from("ordenes_produccion")
    .insert({ agente_id: user.id, fecha })
    .select("id").single()
  if (error) throw error

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("items_produccion").insert(
      items.map(i => ({ orden_id: orden.id, ...i }))
    )
    if (itemsError) throw itemsError
  }

  revalidatePath("/portal/panaderia/produccion")
  revalidatePath("/portal/panaderia")
  return { success: true, orden_id: orden.id }
}

export async function actualizarProducido(item_id: string, cantidad_real: number) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("items_produccion").update({ cantidad_real }).eq("id", item_id)
  if (error) throw error
  revalidatePath("/portal/panaderia/produccion")
}

export async function actualizarEstadoOrden(orden_id: string, estado: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("ordenes_produccion").update({ estado }).eq("id", orden_id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/panaderia/produccion")
  revalidatePath("/portal/panaderia")
}

// ── Ventas ────────────────────────────────────────────────────────────────────
export async function registrarVenta(fecha: string, items: { producto_id: string; cantidad: number; precio_unitario: number }[], notas?: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: venta, error } = await supabase
    .from("ventas_pan")
    .insert({ agente_id: user.id, fecha, notas: notas ?? null })
    .select("id").single()
  if (error) throw error

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("items_venta_pan").insert(
      items.map(i => ({ venta_id: venta.id, ...i }))
    )
    if (itemsError) throw itemsError
  }

  revalidatePath("/portal/panaderia/ventas")
  revalidatePath("/portal/panaderia")
  return { success: true, venta_id: venta.id }
}

// ── Inventario ────────────────────────────────────────────────────────────────
export async function crearInsumo(data: {
  nombre: string; unidad: string; stock_actual: number; stock_minimo: number; precio_unidad: number
}) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("insumos_pan").insert({ agente_id: user.id, ...data })
  if (error) throw error
  revalidatePath("/portal/panaderia/inventario")
}

export async function registrarMovimientoInsumo(insumo_id: string, tipo: "entrada" | "salida" | "ajuste", cantidad: number, nota?: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase.from("movimientos_insumos").insert({
    insumo_id, agente_id: user.id, tipo, cantidad, nota: nota ?? null
  })
  if (error) throw error
  revalidatePath("/portal/panaderia/inventario")
}
