"use server"

import { revalidatePath } from "next/cache"
import { requireNegocioAccion, type RolFarmacia } from "@/lib/farmacia/contexto"
import { montoNoNegativo, montoValido, textoRequerido, unoDe } from "@/lib/portal-security"
import { METODOS_PAGO_FARMACIA } from "@/lib/farmacia/pos-constants"

const ROLES = ["dueno", "regente", "cajero"] as const

async function logEquipo(supabase: any, adminId: string, action: string, detalle: Record<string, unknown>) {
  const { error } = await supabase.from("audit_logs").insert({
    admin_id: adminId, action, entity_type: "user",
    entity_name: detalle.email ?? null, details: detalle,
  })
  if (error) console.error("[audit_logs]", error.message)
}

// ── Gestión del equipo (solo dueño; la función SQL lo re-verifica) ────────────
export async function agregarMiembro(email: string, rol: string) {
  const { supabase, user, negocioId } = await requireNegocioAccion(["dueno"])

  const correo = textoRequerido(email, "correo").toLowerCase()
  const rolValido = unoDe(rol, ROLES, "rol") as RolFarmacia

  const { data, error } = await supabase.rpc("agregar_miembro_negocio", {
    p_negocio: negocioId,
    p_email:   correo,
    p_rol:     rolValido,
  })
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "agregar_miembro", { email: correo, rol: rolValido })

  revalidatePath("/portal/farmacia/equipo")
  revalidatePath("/portal/farmacia")
  return data as { user_id: string; nombre: string; aprobado: boolean }
}

export async function cambiarRolMiembro(miembroId: string, rol: string) {
  const { supabase, user } = await requireNegocioAccion(["dueno"])
  const rolValido = unoDe(rol, ROLES, "rol")

  const { error } = await supabase.rpc("cambiar_rol_miembro", {
    p_miembro: miembroId,
    p_rol:     rolValido,
  })
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "cambiar_rol_miembro", { miembro_id: miembroId, rol: rolValido })

  revalidatePath("/portal/farmacia/equipo")
  return { success: true }
}

export async function quitarMiembro(miembroId: string) {
  const { supabase, user } = await requireNegocioAccion(["dueno"])

  const { error } = await supabase.rpc("quitar_miembro_negocio", { p_miembro: miembroId })
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "quitar_miembro", { miembro_id: miembroId })

  revalidatePath("/portal/farmacia/equipo")
  revalidatePath("/portal/farmacia")
  return { success: true }
}

// ── Datos del negocio (dueño) ─────────────────────────────────────────────────
export async function actualizarNegocio(data: {
  nombre: string; nit?: string; direccion?: string; telefono?: string
}) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno"])

  const { error } = await supabase.from("negocios").update({
    nombre:    textoRequerido(data.nombre, "nombre del negocio"),
    nit:       data.nit?.trim() || null,
    direccion: data.direccion?.trim() || null,
    telefono:  data.telefono?.trim() || null,
  }).eq("id", negocioId)
  if (error) throw error

  revalidatePath("/portal/farmacia")
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 1 · INVENTARIO — dueño y regente gestionan; el cajero solo consulta
// ═══════════════════════════════════════════════════════════════════════════

const TIPOS_MOVIMIENTO = [
  "entrada_venta", "entrada_bodega",
  "traslado_a_venta", "traslado_a_bodega",
  "merma_venta", "merma_bodega",
] as const

export interface ProductoFarmaciaInput {
  codigo_barras?:    string
  nombre:            string
  principio_activo?: string
  concentracion?:    string
  presentacion?:     string
  laboratorio_id?:   string | null
  proveedor_id?:     string | null
  categoria?:        string
  registro_invima?:  string
  precio_venta:      number
  costo:             number
  requiere_receta?:  boolean
  activo?:           boolean
}

function limpiarProducto(data: ProductoFarmaciaInput) {
  return {
    codigo_barras:    data.codigo_barras?.trim() || null,
    nombre:           textoRequerido(data.nombre, "nombre del producto"),
    principio_activo: data.principio_activo?.trim() || null,
    concentracion:    data.concentracion?.trim() || null,
    presentacion:     data.presentacion?.trim() || null,
    laboratorio_id:   data.laboratorio_id || null,
    proveedor_id:     data.proveedor_id || null,
    categoria:        data.categoria?.trim() || "otros",
    registro_invima:  data.registro_invima?.trim() || null,
    precio_venta:     montoNoNegativo(data.precio_venta, "precio de venta"),
    costo:            montoNoNegativo(data.costo, "costo"),
    requiere_receta:  Boolean(data.requiere_receta),
  }
}

export async function crearProductoFarmacia(data: ProductoFarmaciaInput) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno", "regente"])

  const { data: prod, error } = await supabase
    .from("productos_farmacia")
    .insert({ negocio_id: negocioId, ...limpiarProducto(data) })
    .select("id").single()
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un producto con ese código de barras")
    throw new Error(error.message)
  }

  revalidatePath("/portal/farmacia/inventario")
  return { producto_id: prod.id as string }
}

export async function editarProductoFarmacia(id: string, data: ProductoFarmaciaInput) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno", "regente"])

  const { error } = await supabase
    .from("productos_farmacia")
    .update({ ...limpiarProducto(data), activo: data.activo ?? true })
    .eq("id", id).eq("negocio_id", negocioId)
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un producto con ese código de barras")
    throw new Error(error.message)
  }

  revalidatePath("/portal/farmacia/inventario")
  revalidatePath(`/portal/farmacia/inventario/${id}`)
  return { success: true }
}

// El regente INACTIVA; la eliminación definitiva es solo del dueño (y la RLS
// lo vuelve a verificar en la base).
export async function eliminarProductoFarmacia(id: string) {
  const { supabase, negocioId, user } = await requireNegocioAccion(["dueno"])

  const { data: prod } = await supabase
    .from("productos_farmacia").select("nombre")
    .eq("id", id).eq("negocio_id", negocioId).maybeSingle()

  const { error } = await supabase
    .from("productos_farmacia").delete()
    .eq("id", id).eq("negocio_id", negocioId)
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "eliminar_producto_farmacia", { producto: prod?.nombre ?? id })

  revalidatePath("/portal/farmacia/inventario")
  return { success: true }
}

// ── Catálogos de apoyo ────────────────────────────────────────────────────────
export async function crearProveedorFarmacia(nombre: string) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno", "regente"])
  const { data, error } = await supabase
    .from("proveedores_farmacia")
    .insert({ negocio_id: negocioId, nombre: textoRequerido(nombre, "nombre del proveedor") })
    .select("id, nombre").single()
  if (error) {
    if (error.code === "23505") throw new Error("Ese proveedor ya existe")
    throw new Error(error.message)
  }
  revalidatePath("/portal/farmacia/inventario")
  return data
}

export async function crearLaboratorioFarmacia(nombre: string) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno", "regente"])
  const { data, error } = await supabase
    .from("laboratorios_farmacia")
    .insert({ negocio_id: negocioId, nombre: textoRequerido(nombre, "nombre del laboratorio") })
    .select("id, nombre").single()
  if (error) {
    if (error.code === "23505") throw new Error("Ese laboratorio ya existe")
    throw new Error(error.message)
  }
  revalidatePath("/portal/farmacia/inventario")
  return data
}

// ── Lotes y movimientos (las RPC validan rol y stock en la base) ─────────────
export async function crearLoteFarmacia(input: {
  producto_id: string; lote: string; fecha_vencimiento: string
  cantidad_venta: number; cantidad_bodega: number; estanteria?: string
}) {
  const { supabase } = await requireNegocioAccion(["dueno", "regente"])

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha_vencimiento)) {
    throw new Error("Fecha de vencimiento inválida")
  }
  const venta  = montoNoNegativo(input.cantidad_venta, "cantidad en venta")
  const bodega = montoNoNegativo(input.cantidad_bodega, "cantidad en bodega")
  if (venta + bodega <= 0) throw new Error("Ingresa al menos una unidad")

  const { data, error } = await supabase.rpc("crear_lote_farmacia", {
    p_producto:    input.producto_id,
    p_lote:        textoRequerido(input.lote, "número de lote"),
    p_vencimiento: input.fecha_vencimiento,
    p_cant_venta:  venta,
    p_cant_bodega: bodega,
    p_estanteria:  input.estanteria?.trim() || null,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/portal/farmacia/inventario")
  revalidatePath(`/portal/farmacia/inventario/${input.producto_id}`)
  return { lote_id: data as string }
}

export async function registrarMovimientoFarmacia(input: {
  lote_id: string; producto_id: string; tipo: string; cantidad: number; motivo?: string
}) {
  const { supabase } = await requireNegocioAccion(["dueno", "regente"])

  const tipo = unoDe(input.tipo, TIPOS_MOVIMIENTO, "tipo de movimiento")
  const cantidad = montoValido(input.cantidad, "cantidad")

  const { error } = await supabase.rpc("registrar_movimiento_farmacia", {
    p_lote:     input.lote_id,
    p_tipo:     tipo,
    p_cantidad: cantidad,
    p_motivo:   input.motivo?.trim() || null,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/portal/farmacia/inventario")
  revalidatePath(`/portal/farmacia/inventario/${input.producto_id}`)
  return { success: true }
}

export async function actualizarEstanteria(loteId: string, productoId: string, estanteria: string) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno", "regente"])

  const { error } = await supabase
    .from("lotes_farmacia")
    .update({ estanteria: estanteria.trim() || null })
    .eq("id", loteId).eq("negocio_id", negocioId)
  if (error) throw new Error(error.message)

  revalidatePath(`/portal/farmacia/inventario/${productoId}`)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 2 · POS — cualquier miembro vende; anular es de dueño/regente
// ═══════════════════════════════════════════════════════════════════════════


const ESTADOS_PEDIDO = ["pagado", "pedido", "recibido", "notificado", "entregado", "cancelado"] as const

// El orden del flujo: de cada estado solo se puede avanzar al siguiente
const SIGUIENTE_ESTADO: Record<string, string> = {
  pagado: "pedido", pedido: "recibido", recibido: "notificado", notificado: "entregado",
}

export async function registrarVentaFarmacia(input: {
  items:   { producto_id: string; cantidad: number }[]
  pagos:   { metodo: string; monto: number }[]
  cliente_id?: string | null
}) {
  const { supabase } = await requireNegocioAccion(["dueno", "regente", "cajero"])

  if (!input.items?.length) throw new Error("La venta debe tener al menos un producto")
  if (!input.pagos?.length) throw new Error("Falta el pago")

  const items = input.items.map(i => ({
    producto_id: i.producto_id,
    cantidad: montoValido(i.cantidad, "cantidad"),
  }))
  const pagos = input.pagos.map(p => ({
    metodo: unoDe(p.metodo, METODOS_PAGO_FARMACIA, "método de pago"),
    monto:  montoValido(p.monto, "monto del pago"),
  }))

  const { data, error } = await supabase.rpc("registrar_venta_farmacia", {
    p_items:   items,
    p_pagos:   pagos,
    p_cliente: input.cliente_id || null,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/portal/farmacia/pos")
  revalidatePath("/portal/farmacia/ventas")
  revalidatePath("/portal/farmacia/inventario")
  return data as { venta_id: string; numero: number; total: number; vuelto: number }
}

export async function anularVentaFarmacia(ventaId: string, motivo: string) {
  const { supabase, user } = await requireNegocioAccion(["dueno", "regente"])

  const { error } = await supabase.rpc("anular_venta_farmacia", {
    p_venta:  ventaId,
    p_motivo: textoRequerido(motivo, "motivo de la anulación"),
  })
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "anular_venta_farmacia", { venta_id: ventaId, motivo })

  revalidatePath("/portal/farmacia/ventas")
  revalidatePath("/portal/farmacia/inventario")
  return { success: true }
}

// ── Clientes (el cajero puede registrarlos, según el brief) ──────────────────
export async function crearClienteFarmacia(data: { nombre: string; cedula?: string; telefono?: string }) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno", "regente", "cajero"])

  const { data: cliente, error } = await supabase
    .from("clientes_farmacia")
    .insert({
      negocio_id: negocioId,
      nombre:   textoRequerido(data.nombre, "nombre del cliente"),
      cedula:   data.cedula?.trim() || null,
      telefono: data.telefono?.trim() || null,
    })
    .select("id, nombre, cedula, telefono").single()
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un cliente con esa cédula")
    throw new Error(error.message)
  }

  revalidatePath("/portal/farmacia/pos")
  return cliente
}

// ── Pedidos pendientes ────────────────────────────────────────────────────────
export async function crearPedidoFarmacia(input: {
  cliente_id:  string
  producto_id?: string | null
  descripcion: string
  cantidad:    number
  total:       number
  monto_pagado: number
  metodo_pago?: string | null
  notas?:      string
}) {
  const { supabase, negocioId, user } = await requireNegocioAccion(["dueno", "regente", "cajero"])

  const total  = montoNoNegativo(input.total, "total del encargo")
  const pagado = montoNoNegativo(input.monto_pagado, "monto pagado")
  if (pagado > total) throw new Error("Lo pagado no puede superar el total")
  if (pagado > 0 && !input.metodo_pago) throw new Error("Indica el método del pago")

  const { error } = await supabase.from("pedidos_farmacia").insert({
    negocio_id:  negocioId,
    cliente_id:  input.cliente_id,
    producto_id: input.producto_id || null,
    descripcion: textoRequerido(input.descripcion, "descripción del encargo"),
    cantidad:    montoValido(input.cantidad, "cantidad"),
    total,
    monto_pagado: pagado,
    metodo_pago: input.metodo_pago ? unoDe(input.metodo_pago, METODOS_PAGO_FARMACIA, "método de pago") : null,
    notas:       input.notas?.trim() || null,
    user_id:     user.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/portal/farmacia/pedidos")
  return { success: true }
}

export async function avanzarPedidoFarmacia(pedidoId: string) {
  const { supabase, negocioId } = await requireNegocioAccion(["dueno", "regente", "cajero"])

  const { data: pedido } = await supabase
    .from("pedidos_farmacia").select("estado")
    .eq("id", pedidoId).eq("negocio_id", negocioId).maybeSingle()
  if (!pedido) throw new Error("Pedido no encontrado")

  const siguiente = SIGUIENTE_ESTADO[pedido.estado]
  if (!siguiente) throw new Error("Este pedido ya no puede avanzar")

  const { error } = await supabase
    .from("pedidos_farmacia").update({ estado: siguiente })
    .eq("id", pedidoId).eq("negocio_id", negocioId)
  if (error) throw new Error(error.message)

  revalidatePath("/portal/farmacia/pedidos")
  return { estado: siguiente }
}

export async function cancelarPedidoFarmacia(pedidoId: string, motivo: string) {
  const { supabase, negocioId, user } = await requireNegocioAccion(["dueno", "regente"])

  const { data: pedido } = await supabase
    .from("pedidos_farmacia").select("estado, descripcion")
    .eq("id", pedidoId).eq("negocio_id", negocioId).maybeSingle()
  if (!pedido) throw new Error("Pedido no encontrado")
  if (pedido.estado === "entregado" || pedido.estado === "cancelado") {
    throw new Error("Este pedido ya está cerrado")
  }

  const nota = textoRequerido(motivo, "motivo de la cancelación")
  const { error } = await supabase
    .from("pedidos_farmacia")
    .update({ estado: "cancelado", notas: nota })
    .eq("id", pedidoId).eq("negocio_id", negocioId)
  if (error) throw new Error(error.message)

  await logEquipo(supabase, user.id, "cancelar_pedido_farmacia", {
    pedido_id: pedidoId, descripcion: pedido.descripcion, motivo: nota,
  })

  revalidatePath("/portal/farmacia/pedidos")
  return { success: true }
}
