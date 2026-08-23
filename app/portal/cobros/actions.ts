"use server"

import { revalidatePath } from "next/cache"
import { requirePortalAccess, montoValido, textoRequerido } from "@/lib/portal-security"

export async function crearClienteCobro(data: {
  nombre: string; cedula?: string; telefono?: string; direccion?: string
}) {
  const { supabase, user } = await requirePortalAccess("cobros")

  const { data: cliente, error } = await supabase
    .from("clientes_cobro")
    .insert({ ...data, agente_id: user.id, nombre: textoRequerido(data.nombre, "nombre del cliente") })
    .select("id").single()

  if (error) throw error
  revalidatePath("/portal/cobros/clientes")
  return cliente
}

export async function crearCobro(input: {
  cliente_id?: string
  cliente_nombre?: string
  cliente_cedula?: string
  cliente_telefono?: string
  descripcion: string
  monto_total: number
  fecha_vencimiento?: string
  notas?: string
}) {
  const { supabase, user } = await requirePortalAccess("cobros")

  const descripcion = textoRequerido(input.descripcion, "concepto del cobro")
  const montoTotal  = montoValido(input.monto_total, "monto total")

  let clienteId = input.cliente_id

  if (clienteId) {
    // El cliente debe ser del agente — la FK no respeta RLS
    const { data: propio } = await supabase
      .from("clientes_cobro").select("id")
      .eq("id", clienteId).eq("agente_id", user.id).maybeSingle()
    if (!propio) throw new Error("Cliente no encontrado")
  } else {
    if (!input.cliente_nombre) throw new Error("Nombre del cliente requerido")
    const { data: c, error } = await supabase
      .from("clientes_cobro")
      .insert({
        agente_id: user.id,
        nombre:    textoRequerido(input.cliente_nombre, "nombre del cliente"),
        cedula:    input.cliente_cedula   ?? null,
        telefono:  input.cliente_telefono ?? null,
      })
      .select("id").single()
    if (error) throw error
    clienteId = c.id
  }

  const { data: cobro, error } = await supabase
    .from("cobros")
    .insert({
      agente_id:        user.id,
      cliente_id:       clienteId,
      descripcion,
      monto_total:      montoTotal,
      fecha_vencimiento: input.fecha_vencimiento ?? null,
      notas:            input.notas ?? null,
    })
    .select("id").single()

  if (error) throw error
  revalidatePath("/portal/cobros")
  return { success: true, cobro_id: cobro.id }
}

export async function registrarPagoCobro(
  cobro_id: string,
  monto: number,
  fecha?: string,
  nota?: string,
) {
  const { supabase } = await requirePortalAccess("cobros")
  const montoPago = montoValido(monto, "monto del pago")

  // La RPC valida además que el cobro sea del agente (SECURITY DEFINER con chequeo de dueño)
  const { data, error } = await supabase.rpc("aplicar_pago_cobro", {
    p_cobro_id: cobro_id,
    p_monto:    montoPago,
    p_fecha:    fecha ?? new Date().toISOString().split("T")[0],
    p_nota:     nota ?? null,
  })

  if (error) throw error
  revalidatePath("/portal/cobros")
  revalidatePath(`/portal/cobros/${cobro_id}`)
  return { success: true, pago_id: data }
}

export async function cancelarCobro(cobro_id: string) {
  const { supabase, user } = await requirePortalAccess("cobros")

  const { error } = await supabase
    .from("cobros")
    .update({ estado: "cancelado" })
    .eq("id", cobro_id)
    .eq("agente_id", user.id)

  if (error) throw error
  revalidatePath("/portal/cobros")
  revalidatePath(`/portal/cobros/${cobro_id}`)
  return { success: true }
}

export async function editarClienteCobro(
  cliente_id: string,
  data: { nombre: string; cedula?: string; telefono?: string; direccion?: string },
) {
  const { supabase, user } = await requirePortalAccess("cobros")

  const { error } = await supabase
    .from("clientes_cobro")
    .update({
      nombre: textoRequerido(data.nombre, "nombre del cliente"),
      cedula: data.cedula ?? null,
      telefono: data.telefono ?? null,
      direccion: data.direccion ?? null,
    })
    .eq("id", cliente_id).eq("agente_id", user.id)

  if (error) throw error
  revalidatePath("/portal/cobros/clientes")
  return { success: true }
}

export async function obtenerClientesCobro() {
  const { supabase, user } = await requirePortalAccess("cobros")

  const { data, error } = await supabase
    .from("clientes_cobro")
    .select("id, nombre, cedula, telefono")
    .eq("agente_id", user.id)
    .order("nombre")

  if (error) throw error
  return data ?? []
}
