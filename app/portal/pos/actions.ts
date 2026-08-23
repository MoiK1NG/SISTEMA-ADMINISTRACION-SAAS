"use server"

import { revalidatePath } from "next/cache"
import {
  requirePortalAccess, montoValido, montoNoNegativo, enteroPositivo,
  textoRequerido, unoDe,
} from "@/lib/portal-security"
import { CATEGORIAS_POS } from "./constants"

const METODOS_PAGO = ["efectivo", "tarjeta", "transferencia"] as const

// ── Ventas ────────────────────────────────────────────────────────────────────
export async function registrarVentaPos(
  items: { producto_id: string; cantidad: number }[],
  metodo: string,
  montoRecibido?: number,
) {
  const { supabase } = await requirePortalAccess("pos")

  if (!items || items.length === 0) throw new Error("La venta debe tener al menos un producto")
  const itemsValidados = items.map(i => ({
    producto_id: i.producto_id,
    cantidad: enteroPositivo(i.cantidad, "cantidad"),
  }))
  const met = unoDe(metodo, METODOS_PAGO, "método de pago")
  const recibido = montoRecibido != null ? montoValido(montoRecibido, "monto recibido") : null

  // La RPC valida productos, toma precios del catálogo y crea venta + items
  // en una sola transacción.
  const { data, error } = await supabase.rpc("registrar_venta_pos", {
    p_items: itemsValidados,
    p_metodo: met,
    p_monto_recibido: recibido,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/portal/pos")
  revalidatePath("/portal/pos/ventas")
  return data as { venta_id: string; subtotal: number; impuesto: number; total: number; vuelto: number | null }
}

// ── Productos ─────────────────────────────────────────────────────────────────
export async function crearProductoPos(data: {
  nombre: string; categoria: string; emoji: string; precio: number; disponible: boolean
}) {
  const { supabase, user } = await requirePortalAccess("pos")
  const { error } = await supabase.from("productos_pos").insert({
    agente_id: user.id,
    nombre: textoRequerido(data.nombre, "nombre del producto"),
    categoria: unoDe(data.categoria, CATEGORIAS_POS, "categoría"),
    emoji: (data.emoji || "🛒").slice(0, 8),
    precio: montoNoNegativo(data.precio, "precio"),
    disponible: data.disponible,
  })
  if (error) throw error
  revalidatePath("/portal/pos")
  revalidatePath("/portal/pos/productos")
}

export async function editarProductoPos(id: string, data: {
  nombre: string; categoria: string; emoji: string; precio: number; disponible: boolean
}) {
  const { supabase, user } = await requirePortalAccess("pos")
  const { error } = await supabase.from("productos_pos").update({
    nombre: textoRequerido(data.nombre, "nombre del producto"),
    categoria: unoDe(data.categoria, CATEGORIAS_POS, "categoría"),
    emoji: (data.emoji || "🛒").slice(0, 8),
    precio: montoNoNegativo(data.precio, "precio"),
    disponible: data.disponible,
  }).eq("id", id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/pos")
  revalidatePath("/portal/pos/productos")
}

export async function eliminarProductoPos(id: string) {
  const { supabase, user } = await requirePortalAccess("pos")
  // Las ventas históricas conservan nombre y precio (snapshot en items_venta_pos)
  const { error } = await supabase.from("productos_pos").delete().eq("id", id).eq("agente_id", user.id)
  if (error) throw error
  revalidatePath("/portal/pos")
  revalidatePath("/portal/pos/productos")
}
