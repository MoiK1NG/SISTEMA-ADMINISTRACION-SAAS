"use server"

import { revalidatePath } from "next/cache"
import { requireClient } from "@/lib/supabase/require-client"

export type FrecuenciaPago = "diario" | "semanal" | "quincenal" | "mensual"

export interface NuevoPrestamoInput {
  cliente_id?:       string
  cliente_nombre?:   string
  cliente_cedula?:   string
  cliente_telefono?: string
  cliente_direccion?: string
  monto_principal:   number
  tasa_interes:      number
  frecuencia:        FrecuenciaPago
  num_cuotas:        number
  fecha_inicio:      string
}

export async function crearPrestamo(input: NuevoPrestamoInput) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .limit(1)
    .maybeSingle()

  if (!membership) throw new Error("Membresía expirada o inactiva")

  let clienteId = input.cliente_id

  if (!clienteId) {
    if (!input.cliente_nombre) throw new Error("Nombre del cliente requerido")

    const { data: nuevoCliente, error: clienteError } = await supabase
      .from("clientes")
      .insert({
        agente_id: user.id,
        nombre:    input.cliente_nombre,
        cedula:    input.cliente_cedula    ?? null,
        telefono:  input.cliente_telefono  ?? null,
        direccion: input.cliente_direccion ?? null,
      })
      .select("id")
      .single()

    if (clienteError) {
      if (clienteError.code === "23505") {
        const { data: existing } = await supabase
          .from("clientes")
          .select("id")
          .eq("agente_id", user.id)
          .eq("cedula", input.cliente_cedula!)
          .single()
        clienteId = existing?.id
      } else {
        throw clienteError
      }
    } else {
      clienteId = nuevoCliente.id
    }
  }

  if (!clienteId) throw new Error("No se pudo resolver el cliente")

  const { data: prestamo, error: prestamoError } = await supabase
    .from("prestamos")
    .insert({
      agente_id:        user.id,
      cliente_id:       clienteId,
      monto_principal:  input.monto_principal,
      saldo_pendiente:  input.monto_principal,
      tasa_interes:     input.tasa_interes,
      frecuencia:       input.frecuencia,
      num_cuotas:       input.num_cuotas,
      fecha_inicio:     input.fecha_inicio,
      fecha_vencimiento: input.fecha_inicio,
      estado:           "activo",
    })
    .select("id")
    .single()

  if (prestamoError) throw prestamoError

  revalidatePath("/portal/prestamos")
  return { success: true, prestamo_id: prestamo.id }
}

export async function registrarPago(
  prestamo_id: string,
  monto: number,
  fecha?: string,
  nota?: string,
) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase.rpc("registrar_pago", {
    p_prestamo_id: prestamo_id,
    p_monto:       monto,
    p_fecha:       fecha ?? new Date().toISOString().split("T")[0],
    p_nota:        nota ?? null,
  })

  if (error) throw error

  revalidatePath("/portal/prestamos")
  revalidatePath(`/portal/prestamos/${prestamo_id}`)
  return { success: true, pago_id: data }
}

export async function cancelarPrestamo(prestamo_id: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await supabase
    .from("prestamos")
    .update({ estado: "cancelado" })
    .eq("id", prestamo_id)
    .eq("agente_id", user.id)

  if (error) throw error

  revalidatePath("/portal/prestamos")
  revalidatePath(`/portal/prestamos/${prestamo_id}`)
  return { success: true }
}

export async function editarCliente(
  cliente_id: string,
  data: { nombre: string; cedula?: string; telefono?: string; direccion?: string },
) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await supabase
    .from("clientes")
    .update({
      nombre:    data.nombre,
      cedula:    data.cedula    ?? null,
      telefono:  data.telefono  ?? null,
      direccion: data.direccion ?? null,
    })
    .eq("id", cliente_id)
    .eq("agente_id", user.id)

  if (error) throw error

  revalidatePath("/portal/prestamos")
  revalidatePath("/portal/prestamos/clientes")
  return { success: true }
}

export async function eliminarCliente(cliente_id: string) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { count } = await supabase
    .from("prestamos")
    .select("*", { count: "exact", head: true })
    .eq("cliente_id", cliente_id)
    .in("estado", ["activo", "al_dia", "en_mora", "pendiente"])

  if (count && count > 0) {
    throw new Error("No se puede eliminar un cliente con préstamos activos")
  }

  const { error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", cliente_id)
    .eq("agente_id", user.id)

  if (error) throw error

  revalidatePath("/portal/prestamos/clientes")
  return { success: true }
}

export async function obtenerClientes() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, cedula, telefono")
    .eq("agente_id", user.id)
    .order("nombre")

  if (error) throw error
  return data ?? []
}
