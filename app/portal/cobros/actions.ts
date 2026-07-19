"use server"

import { revalidatePath } from "next/cache"
import { requireClient } from "@/lib/supabase/require-client"

export async function crearClienteCobro(data: {
  nombre: string; cedula?: string; telefono?: string; direccion?: string
}) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: cliente, error } = await supabase
    .from("clientes_cobro")
    .insert({ agente_id: user.id, ...data })
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
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  let clienteId = input.cliente_id

  if (!clienteId) {
    if (!input.cliente_nombre) throw new Error("Nombre del cliente requerido")
    const { data: c, error } = await supabase
      .from("clientes_cobro")
      .insert({
        agente_id: user.id,
        nombre:    input.cliente_nombre,
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
      descripcion:      input.descripcion,
      monto_total:      input.monto_total,
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
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase.rpc("aplicar_pago_cobro", {
    p_cobro_id: cobro_id,
    p_monto:    monto,
    p_fecha:    fecha ?? new Date().toISOString().split("T")[0],
    p_nota:     nota ?? null,
  })

  if (error) throw error
  revalidatePath("/portal/cobros")
  revalidatePath(`/portal/cobros/${cobro_id}`)
  return { success: true, pago_id: data }
}

export async function cancelarCobro(cobro_id: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

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
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await supabase
    .from("clientes_cobro")
    .update({ nombre: data.nombre, cedula: data.cedula ?? null, telefono: data.telefono ?? null, direccion: data.direccion ?? null })
    .eq("id", cliente_id).eq("agente_id", user.id)

  if (error) throw error
  revalidatePath("/portal/cobros/clientes")
  return { success: true }
}

export async function obtenerClientesCobro() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("clientes_cobro")
    .select("id, nombre, cedula, telefono")
    .eq("agente_id", user.id)
    .order("nombre")

  if (error) throw error
  return data ?? []
}
