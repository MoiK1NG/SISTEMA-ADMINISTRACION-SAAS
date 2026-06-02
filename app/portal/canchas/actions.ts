"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { EstadoPago, EstadoReserva } from "./types"

// ─── Crear reserva ────────────────────────────────────────────────────────────
export async function crearReserva(input: {
  cancha_id:        string
  cliente_nombre:   string
  cliente_telefono?: string
  fecha:            string   // YYYY-MM-DD
  hora_inicio:      number
  hora_fin:         number
  monto:            number
  estado_pago:      EstadoPago
  nota?:            string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await supabase.from("reservas").insert({
    agente_id:        user.id,
    cancha_id:        input.cancha_id,
    cliente_nombre:   input.cliente_nombre,
    cliente_telefono: input.cliente_telefono ?? null,
    fecha:            input.fecha,
    hora_inicio:      input.hora_inicio,
    hora_fin:         input.hora_fin,
    monto:            input.monto,
    monto_pagado:     input.estado_pago === "pagado" ? input.monto : 0,
    estado_pago:      input.estado_pago,
    nota:             input.nota ?? null,
    estado:           "confirmada",
  })

  // Código 23P01 = exclusion constraint (solapamiento de horario)
  if (error?.code === "23P01") throw new Error("Ese horario ya está reservado en esta cancha")
  if (error) throw error

  revalidatePath("/portal/canchas")
  return { success: true }
}

// ─── Actualizar estado de pago ────────────────────────────────────────────────
export async function actualizarEstadoPago(
  reservaId: string,
  estadoPago: EstadoPago,
  montoPagado: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await supabase
    .from("reservas")
    .update({ estado_pago: estadoPago, monto_pagado: montoPagado, updated_at: new Date().toISOString() })
    .eq("id", reservaId)
    .eq("agente_id", user.id)   // RLS extra: solo el dueño

  if (error) throw error

  revalidatePath("/portal/canchas")
  return { success: true }
}

// ─── Cancelar reserva ─────────────────────────────────────────────────────────
export async function cancelarReserva(reservaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await supabase
    .from("reservas")
    .update({ estado: "cancelada", updated_at: new Date().toISOString() })
    .eq("id", reservaId)
    .eq("agente_id", user.id)

  if (error) throw error

  revalidatePath("/portal/canchas")
  return { success: true }
}

// ─── Obtener canchas del agente ───────────────────────────────────────────────
export async function obtenerCanchas() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("canchas")
    .select("id, nombre, tipo, precio_hora, orden")
    .eq("agente_id", user.id)
    .eq("is_active", true)
    .order("orden")

  if (error) throw error
  return data ?? []
}
