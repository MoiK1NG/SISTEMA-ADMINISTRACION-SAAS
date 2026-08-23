"use server"

import { revalidatePath } from "next/cache"
import {
  requirePortalAccess, montoNoNegativo, enteroPositivo, enteroNoNegativo,
  textoRequerido, unoDe,
} from "@/lib/portal-security"

const ESTADOS_MESA  = ["libre", "ocupada", "reservada", "cerrada"] as const
const ESTADOS_ITEM  = ["pendiente", "preparando", "listo", "entregado"] as const
const METODOS_PAGO  = ["efectivo", "tarjeta", "transferencia"] as const

// ── Mesas ─────────────────────────────────────────────────────────────────────
export async function crearMesa(numero: number, capacidad: number) {
  const { supabase, user } = await requirePortalAccess("restaurante")
  const num = enteroPositivo(numero, "número de mesa")
  const cap = enteroPositivo(capacidad, "capacidad")
  const { error } = await supabase.from("mesas_rest").insert({ agente_id: user.id, numero: num, capacidad: cap })
  if (error) throw error
  revalidatePath("/portal/restaurante")
}

export async function actualizarEstadoMesa(mesa_id: string, estado: string) {
  const { supabase, user } = await requirePortalAccess("restaurante")
  const est = unoDe(estado, ESTADOS_MESA, "estado de mesa")
  const { error } = await supabase.from("mesas_rest").update({ estado: est }).eq("id", mesa_id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/restaurante")
}

// ── Menú ──────────────────────────────────────────────────────────────────────
export async function crearCategoria(nombre: string, orden: number) {
  const { supabase, user } = await requirePortalAccess("restaurante")
  const { data, error } = await supabase.from("menu_categorias").insert({
    agente_id: user.id,
    nombre: textoRequerido(nombre, "nombre de la categoría"),
    orden: enteroNoNegativo(orden, "posición"),
  }).select("id").single()
  if (error) throw error
  revalidatePath("/portal/restaurante/menu")
  return data
}

export async function crearMenuItem(data: {
  categoria_id?: string; nombre: string; descripcion?: string; precio: number; disponible: boolean
}) {
  const { supabase, user } = await requirePortalAccess("restaurante")
  const { error } = await supabase.from("menu_items_rest").insert({
    agente_id: user.id,
    categoria_id: data.categoria_id,
    nombre: textoRequerido(data.nombre, "nombre del plato"),
    descripcion: data.descripcion,
    precio: montoNoNegativo(data.precio, "precio"),
    disponible: data.disponible,
  })
  if (error) throw error
  revalidatePath("/portal/restaurante/menu")
}

export async function editarMenuItem(id: string, data: {
  nombre: string; descripcion?: string; precio: number; disponible: boolean; categoria_id?: string
}) {
  const { supabase, user } = await requirePortalAccess("restaurante")
  const { error } = await supabase.from("menu_items_rest").update({
    nombre: textoRequerido(data.nombre, "nombre del plato"),
    descripcion: data.descripcion,
    precio: montoNoNegativo(data.precio, "precio"),
    disponible: data.disponible,
    categoria_id: data.categoria_id,
  }).eq("id", id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/restaurante/menu")
}

// ── Órdenes ───────────────────────────────────────────────────────────────────
export async function abrirOrden(mesa_id: string) {
  const { supabase, user } = await requirePortalAccess("restaurante")

  const { data: mesa } = await supabase
    .from("mesas_rest").select("id").eq("id", mesa_id).eq("agente_id", user.id).maybeSingle()
  if (!mesa) throw new Error("Mesa no encontrada")

  await supabase.from("mesas_rest").update({ estado: "ocupada" }).eq("id", mesa_id).eq("agente_id", user.id)

  const { data, error } = await supabase
    .from("ordenes_rest")
    .insert({ agente_id: user.id, mesa_id })
    .select("id").single()
  if (error) throw error

  revalidatePath("/portal/restaurante")
  return { orden_id: data.id }
}

export async function agregarItemOrden(orden_id: string, menu_item_id: string, cantidad: number, nota?: string) {
  const { supabase, user } = await requirePortalAccess("restaurante")
  const qty = enteroPositivo(cantidad, "cantidad")

  const { data: orden } = await supabase
    .from("ordenes_rest").select("id, estado").eq("id", orden_id).eq("agente_id", user.id).maybeSingle()
  if (!orden) throw new Error("Orden no encontrada")
  if (orden.estado !== "abierta") throw new Error("La orden ya está cerrada")

  // El precio SIEMPRE sale del menú en el servidor, nunca del cliente
  const { data: item } = await supabase
    .from("menu_items_rest").select("precio, disponible")
    .eq("id", menu_item_id).eq("agente_id", user.id).maybeSingle()
  if (!item) throw new Error("Plato no encontrado")
  if (!item.disponible) throw new Error("El plato no está disponible")

  const { error } = await supabase.from("items_orden_rest").insert({
    orden_id, menu_item_id, cantidad: qty, precio_unitario: item.precio, nota: nota ?? null,
  })
  if (error) throw error
  revalidatePath(`/portal/restaurante/orden/${orden_id}`)
}

export async function actualizarEstadoItem(item_id: string, estado: string) {
  const { supabase } = await requirePortalAccess("restaurante")
  const est = unoDe(estado, ESTADOS_ITEM, "estado del item")
  const { error } = await supabase.from("items_orden_rest").update({ estado: est }).eq("id", item_id)
  if (error) throw error
  revalidatePath("/portal/restaurante")
}

export async function cerrarOrden(orden_id: string, metodo: string) {
  const { supabase, user } = await requirePortalAccess("restaurante")
  const met = unoDe(metodo, METODOS_PAGO, "método de pago")

  // El monto del pago es el total calculado en la BD, nunca lo que mande el cliente
  const { data: orden } = await supabase
    .from("ordenes_rest").select("id, estado, total")
    .eq("id", orden_id).eq("agente_id", user.id).maybeSingle()
  if (!orden) throw new Error("Orden no encontrada")
  if (orden.estado !== "abierta") throw new Error("La orden ya está cerrada")
  const total = Number(orden.total)
  if (!(total > 0)) throw new Error("La orden no tiene items para cobrar")

  const { error: pagoError } = await supabase.from("pagos_rest").insert({
    orden_id, agente_id: user.id, monto: total, metodo: met,
  })
  if (pagoError) throw pagoError

  // Actualizar estado — el trigger libera la mesa automáticamente
  const { error } = await supabase.from("ordenes_rest").update({ estado: "pagada" }).eq("id", orden_id).eq("agente_id", user.id)
  if (error) throw error

  revalidatePath("/portal/restaurante")
  revalidatePath(`/portal/restaurante/orden/${orden_id}`)
  return { success: true }
}

export async function cancelarOrden(orden_id: string) {
  const { supabase, user } = await requirePortalAccess("restaurante")
  const { error } = await supabase.from("ordenes_rest").update({ estado: "cancelada" }).eq("id", orden_id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/restaurante")
}
