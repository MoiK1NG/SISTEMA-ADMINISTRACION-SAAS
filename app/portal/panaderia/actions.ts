"use server"

import { revalidatePath } from "next/cache"
import {
  requirePortalAccess, montoValido, montoNoNegativo, enteroPositivo,
  enteroNoNegativo, textoRequerido, unoDe,
} from "@/lib/portal-security"

const CATEGORIAS_PRODUCTO = ["pan", "bizcocho", "reposteria", "bebida", "otro"] as const
const ESTADOS_ORDEN       = ["pendiente", "en_proceso", "completada", "cancelada"] as const
const TIPOS_MOVIMIENTO    = ["entrada", "salida", "ajuste"] as const

// ── Productos ─────────────────────────────────────────────────────────────────
export async function crearProducto(data: {
  nombre: string; categoria: string; precio_venta: number; costo_produccion: number; unidad: string
}) {
  const { supabase, user } = await requirePortalAccess("panaderia")
  const { error } = await supabase.from("productos_pan").insert({
    agente_id: user.id,
    nombre: textoRequerido(data.nombre, "nombre del producto"),
    categoria: unoDe(data.categoria, CATEGORIAS_PRODUCTO, "categoría"),
    precio_venta: montoNoNegativo(data.precio_venta, "precio de venta"),
    costo_produccion: montoNoNegativo(data.costo_produccion, "costo de producción"),
    unidad: textoRequerido(data.unidad, "unidad"),
  })
  if (error) throw error
  revalidatePath("/portal/panaderia/productos")
}

export async function editarProducto(id: string, data: {
  nombre: string; categoria: string; precio_venta: number; costo_produccion: number; unidad: string; activo: boolean
}) {
  const { supabase, user } = await requirePortalAccess("panaderia")
  const { error } = await supabase.from("productos_pan").update({
    nombre: textoRequerido(data.nombre, "nombre del producto"),
    categoria: unoDe(data.categoria, CATEGORIAS_PRODUCTO, "categoría"),
    precio_venta: montoNoNegativo(data.precio_venta, "precio de venta"),
    costo_produccion: montoNoNegativo(data.costo_produccion, "costo de producción"),
    unidad: textoRequerido(data.unidad, "unidad"),
    activo: data.activo,
  }).eq("id", id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/panaderia/productos")
}

// ── Órdenes de producción ─────────────────────────────────────────────────────
export async function crearOrdenProduccion(fecha: string, items: { producto_id: string; cantidad_plan: number }[]) {
  const { supabase, user } = await requirePortalAccess("panaderia")

  const itemsValidados = items.map(i => ({
    producto_id: i.producto_id,
    cantidad_plan: enteroPositivo(i.cantidad_plan, "cantidad planificada"),
  }))

  // Verificar que todos los productos sean del agente
  if (itemsValidados.length > 0) {
    const ids = [...new Set(itemsValidados.map(i => i.producto_id))]
    const { data: propios } = await supabase
      .from("productos_pan").select("id").in("id", ids).eq("agente_id", user.id)
    if ((propios?.length ?? 0) !== ids.length) throw new Error("Producto no encontrado")
  }

  const { data: orden, error } = await supabase
    .from("ordenes_produccion")
    .insert({ agente_id: user.id, fecha })
    .select("id").single()
  if (error) throw error

  if (itemsValidados.length > 0) {
    const { error: itemsError } = await supabase.from("items_produccion").insert(
      itemsValidados.map(i => ({ orden_id: orden.id, ...i }))
    )
    if (itemsError) throw itemsError
  }

  revalidatePath("/portal/panaderia/produccion")
  revalidatePath("/portal/panaderia")
  return { success: true, orden_id: orden.id }
}

export async function actualizarProducido(item_id: string, cantidad_real: number) {
  const { supabase } = await requirePortalAccess("panaderia")
  const qty = enteroNoNegativo(cantidad_real, "cantidad producida")
  const { error } = await supabase.from("items_produccion").update({ cantidad_real: qty }).eq("id", item_id)
  if (error) throw error
  revalidatePath("/portal/panaderia/produccion")
}

export async function actualizarEstadoOrden(orden_id: string, estado: string) {
  const { supabase, user } = await requirePortalAccess("panaderia")
  const est = unoDe(estado, ESTADOS_ORDEN, "estado de la orden")
  const { error } = await supabase.from("ordenes_produccion").update({ estado: est }).eq("id", orden_id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/panaderia/produccion")
  revalidatePath("/portal/panaderia")
}

// ── Ventas ────────────────────────────────────────────────────────────────────
export async function registrarVenta(fecha: string, items: { producto_id: string; cantidad: number }[], notas?: string) {
  const { supabase, user } = await requirePortalAccess("panaderia")
  if (items.length === 0) throw new Error("La venta debe tener al menos un producto")

  const cantidades = new Map(items.map(i => [i.producto_id, enteroPositivo(i.cantidad, "cantidad")]))

  // El precio SIEMPRE sale del catálogo en el servidor, nunca del cliente
  const ids = [...cantidades.keys()]
  const { data: productos } = await supabase
    .from("productos_pan").select("id, precio_venta")
    .in("id", ids).eq("agente_id", user.id).eq("activo", true)
  if ((productos?.length ?? 0) !== ids.length) throw new Error("Producto no encontrado o inactivo")

  const { data: venta, error } = await supabase
    .from("ventas_pan")
    .insert({ agente_id: user.id, fecha, notas: notas ?? null })
    .select("id").single()
  if (error) throw error

  const { error: itemsError } = await supabase.from("items_venta_pan").insert(
    productos!.map(p => ({
      venta_id: venta.id,
      producto_id: p.id,
      cantidad: cantidades.get(p.id)!,
      precio_unitario: p.precio_venta,
    }))
  )
  if (itemsError) throw itemsError

  revalidatePath("/portal/panaderia/ventas")
  revalidatePath("/portal/panaderia")
  return { success: true, venta_id: venta.id }
}

// ── Inventario ────────────────────────────────────────────────────────────────
export async function crearInsumo(data: {
  nombre: string; unidad: string; stock_actual: number; stock_minimo: number; precio_unidad: number
}) {
  const { supabase, user } = await requirePortalAccess("panaderia")
  const { error } = await supabase.from("insumos_pan").insert({
    agente_id: user.id,
    nombre: textoRequerido(data.nombre, "nombre del insumo"),
    unidad: textoRequerido(data.unidad, "unidad"),
    stock_actual: montoNoNegativo(data.stock_actual, "stock inicial"),
    stock_minimo: montoNoNegativo(data.stock_minimo, "stock mínimo"),
    precio_unidad: montoNoNegativo(data.precio_unidad, "precio por unidad"),
  })
  if (error) throw error
  revalidatePath("/portal/panaderia/inventario")
}

export async function registrarMovimientoInsumo(insumo_id: string, tipo: "entrada" | "salida" | "ajuste", cantidad: number, nota?: string) {
  const { supabase, user } = await requirePortalAccess("panaderia")
  const tipoValido = unoDe(tipo, TIPOS_MOVIMIENTO, "tipo de movimiento")
  const qty = montoValido(cantidad, "cantidad")

  const { data: insumo } = await supabase
    .from("insumos_pan").select("id, stock_actual")
    .eq("id", insumo_id).eq("agente_id", user.id).maybeSingle()
  if (!insumo) throw new Error("Insumo no encontrado")
  if (tipoValido === "salida" && qty > Number(insumo.stock_actual)) {
    throw new Error("Stock insuficiente para esa salida")
  }

  const { error } = await supabase.from("movimientos_insumos").insert({
    insumo_id, agente_id: user.id, tipo: tipoValido, cantidad: qty, nota: nota ?? null,
  })
  if (error) throw error
  revalidatePath("/portal/panaderia/inventario")
}
