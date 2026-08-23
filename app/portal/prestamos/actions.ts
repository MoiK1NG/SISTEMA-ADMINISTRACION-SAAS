"use server"

import { revalidatePath } from "next/cache"
import {
  requirePortalAccess, montoValido, enteroPositivo, textoRequerido, unoDe,
} from "@/lib/portal-security"

export type FrecuenciaPago = "diario" | "semanal" | "quincenal" | "mensual"

const FRECUENCIAS = ["diario", "semanal", "quincenal", "mensual"] as const
const MAX_CUOTAS  = 520 // 10 años de cuotas semanales

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
  const { supabase, user } = await requirePortalAccess("prestamos")

  const montoPrincipal = montoValido(input.monto_principal, "monto del préstamo")
  const frecuencia     = unoDe(input.frecuencia, FRECUENCIAS, "frecuencia de pago")
  const numCuotas      = enteroPositivo(input.num_cuotas, "cantidad de cuotas")
  if (numCuotas > MAX_CUOTAS) throw new Error(`Máximo ${MAX_CUOTAS} cuotas`)
  const tasa = Number(input.tasa_interes)
  if (!Number.isFinite(tasa) || tasa < 0 || tasa > 100) {
    throw new Error("La tasa de interés debe estar entre 0 y 100")
  }

  let clienteId = input.cliente_id

  if (clienteId) {
    // El cliente debe ser del agente — la FK no respeta RLS
    const { data: propio } = await supabase
      .from("clientes").select("id")
      .eq("id", clienteId).eq("agente_id", user.id).maybeSingle()
    if (!propio) throw new Error("Cliente no encontrado")
  } else {
    if (!input.cliente_nombre) throw new Error("Nombre del cliente requerido")

    const { data: nuevoCliente, error: clienteError } = await supabase
      .from("clientes")
      .insert({
        agente_id: user.id,
        nombre:    textoRequerido(input.cliente_nombre, "nombre del cliente"),
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
      monto_principal:  montoPrincipal,
      saldo_pendiente:  montoPrincipal,
      tasa_interes:     tasa,
      frecuencia,
      num_cuotas:       numCuotas,
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
  const { supabase, user } = await requirePortalAccess("prestamos")
  const montoPago = montoValido(monto, "monto del pago")

  // Evitar sobrepago: el saldo nunca debe quedar negativo
  const { data: prestamo } = await supabase
    .from("prestamos").select("saldo_pendiente")
    .eq("id", prestamo_id).eq("agente_id", user.id).maybeSingle()
  if (!prestamo) throw new Error("Préstamo no encontrado")
  if (montoPago > Number(prestamo.saldo_pendiente)) {
    throw new Error("El pago supera el saldo pendiente")
  }

  const { data, error } = await supabase.rpc("registrar_pago", {
    p_prestamo_id: prestamo_id,
    p_monto:       montoPago,
    p_fecha:       fecha ?? new Date().toISOString().split("T")[0],
    p_nota:        nota ?? null,
  })

  if (error) throw error

  revalidatePath("/portal/prestamos")
  revalidatePath(`/portal/prestamos/${prestamo_id}`)
  return { success: true, pago_id: data }
}

export async function cancelarPrestamo(prestamo_id: string) {
  const { supabase, user } = await requirePortalAccess("prestamos")

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
  const { supabase, user } = await requirePortalAccess("prestamos")

  const { error } = await supabase
    .from("clientes")
    .update({
      nombre:    textoRequerido(data.nombre, "nombre del cliente"),
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
  const { supabase, user } = await requirePortalAccess("prestamos")

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
  const { supabase, user } = await requirePortalAccess("prestamos")

  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, cedula, telefono")
    .eq("agente_id", user.id)
    .order("nombre")

  if (error) throw error
  return data ?? []
}
