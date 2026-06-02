"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type FrecuenciaPago = "diario" | "semanal" | "quincenal" | "mensual"

export interface NuevoPrestamoInput {
  // Cliente — puede ser existente o nuevo
  cliente_id?:  string   // si ya existe
  cliente_nombre?: string
  cliente_cedula?: string
  cliente_telefono?: string
  cliente_direccion?: string

  // Términos del préstamo
  monto_principal: number
  tasa_interes:    number   // tasa por período como decimal (ej: 0.05 = 5%)
  frecuencia:      FrecuenciaPago
  num_cuotas:      number
  fecha_inicio:    string   // YYYY-MM-DD
}

// ─── Crear préstamo ───────────────────────────────────────────────────────────
export async function crearPrestamo(input: NuevoPrestamoInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  // Verificar membresía activa y acceso al portal de préstamos
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .limit(1)
    .maybeSingle()

  if (!membership) throw new Error("Membresía expirada o inactiva")

  // ── 1. Resolver cliente ───────────────────────────────────────────────────
  let clienteId = input.cliente_id

  if (!clienteId) {
    if (!input.cliente_nombre) throw new Error("Nombre del cliente requerido")

    // Crear cliente nuevo
    const { data: nuevoCliente, error: clienteError } = await supabase
      .from("clientes")
      .insert({
        agente_id:  user.id,
        nombre:     input.cliente_nombre,
        cedula:     input.cliente_cedula     ?? null,
        telefono:   input.cliente_telefono   ?? null,
        direccion:  input.cliente_direccion  ?? null,
      })
      .select("id")
      .single()

    if (clienteError) {
      // Si la cédula ya existe para este agente, reutilizar el cliente
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

  // ── 2. Insertar préstamo ──────────────────────────────────────────────────
  // El trigger `trg_generar_cuotas` genera el plan de pagos automáticamente.
  const { data: prestamo, error: prestamoError } = await supabase
    .from("prestamos")
    .insert({
      agente_id:       user.id,
      cliente_id:      clienteId,
      monto_principal: input.monto_principal,
      saldo_pendiente: input.monto_principal,
      tasa_interes:    input.tasa_interes,
      frecuencia:      input.frecuencia,
      num_cuotas:      input.num_cuotas,
      fecha_inicio:    input.fecha_inicio,
      fecha_vencimiento: input.fecha_inicio,  // el trigger lo actualiza
      estado:          "activo",
    })
    .select("id")
    .single()

  if (prestamoError) throw prestamoError

  revalidatePath("/portal/prestamos")
  return { success: true, prestamo_id: prestamo.id }
}

// ─── Registrar pago ───────────────────────────────────────────────────────────
export async function registrarPago(
  prestamo_id: string,
  monto: number,
  fecha?: string,
  nota?: string,
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  // Llama a la función SQL que aplica el pago a las cuotas
  const { data, error } = await supabase.rpc("registrar_pago", {
    p_prestamo_id: prestamo_id,
    p_monto:       monto,
    p_fecha:       fecha ?? new Date().toISOString().split("T")[0],
    p_nota:        nota ?? null,
  })

  if (error) throw error

  revalidatePath("/portal/prestamos")
  return { success: true, pago_id: data }
}

// ─── Obtener clientes del agente (para autocompletar) ─────────────────────────
export async function obtenerClientes() {
  const supabase = await createClient()

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
