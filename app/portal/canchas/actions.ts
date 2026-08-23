"use server"

import { revalidatePath } from "next/cache"
import {
  requirePortalAccess, montoValido, montoNoNegativo, textoRequerido, unoDe,
} from "@/lib/portal-security"
import type { EstadoPago } from "./types"

const ESTADOS_PAGO = ["pendiente", "debe_sena", "pagado"] as const

export async function crearReserva(input: {
  cancha_id:        string
  cliente_nombre:   string
  cliente_telefono?: string
  fecha:            string
  hora_inicio:      number
  hora_fin:         number
  monto:            number
  estado_pago:      EstadoPago
  nota?:            string
}) {
  const { supabase, user } = await requirePortalAccess("canchas")

  const monto      = montoValido(input.monto, "monto")
  const estadoPago = unoDe(input.estado_pago, ESTADOS_PAGO, "estado de pago")
  const horaInicio = Number(input.hora_inicio)
  const horaFin    = Number(input.hora_fin)
  if (!Number.isInteger(horaInicio) || !Number.isInteger(horaFin)
      || horaInicio < 0 || horaFin > 24 || horaFin <= horaInicio) {
    throw new Error("Horario inválido")
  }

  // La cancha debe ser del agente
  const { data: cancha } = await supabase
    .from("canchas").select("id")
    .eq("id", input.cancha_id).eq("agente_id", user.id).eq("is_active", true)
    .maybeSingle()
  if (!cancha) throw new Error("Cancha no encontrada")

  const { error } = await supabase.from("reservas").insert({
    agente_id:        user.id,
    cancha_id:        input.cancha_id,
    cliente_nombre:   textoRequerido(input.cliente_nombre, "nombre del cliente"),
    cliente_telefono: input.cliente_telefono ?? null,
    fecha:            input.fecha,
    hora_inicio:      horaInicio,
    hora_fin:         horaFin,
    monto,
    monto_pagado:     estadoPago === "pagado" ? monto : 0,
    estado_pago:      estadoPago,
    nota:             input.nota ?? null,
    estado:           "confirmada",
  })

  if (error?.code === "23P01") throw new Error("Ese horario ya está reservado en esta cancha")
  if (error) throw error

  revalidatePath("/portal/canchas")
  return { success: true }
}

export async function actualizarEstadoPago(
  reservaId: string,
  estadoPago: EstadoPago,
  montoPagado: number,
) {
  const { supabase, user } = await requirePortalAccess("canchas")

  const estado = unoDe(estadoPago, ESTADOS_PAGO, "estado de pago")
  const pagado = montoNoNegativo(montoPagado, "monto pagado")

  const { data: reserva } = await supabase
    .from("reservas").select("id, monto")
    .eq("id", reservaId).eq("agente_id", user.id).maybeSingle()
  if (!reserva) throw new Error("Reserva no encontrada")
  if (pagado > Number(reserva.monto)) {
    throw new Error("El pago no puede superar el monto de la reserva")
  }

  const { error } = await supabase
    .from("reservas")
    .update({ estado_pago: estado, monto_pagado: pagado, updated_at: new Date().toISOString() })
    .eq("id", reservaId)
    .eq("agente_id", user.id)

  if (error) throw error

  revalidatePath("/portal/canchas")
  return { success: true }
}

export async function cancelarReserva(reservaId: string) {
  const { supabase, user } = await requirePortalAccess("canchas")

  const { error } = await supabase
    .from("reservas")
    .update({ estado: "cancelada", updated_at: new Date().toISOString() })
    .eq("id", reservaId)
    .eq("agente_id", user.id)

  if (error) throw error

  revalidatePath("/portal/canchas")
  return { success: true }
}

export async function obtenerCanchas() {
  const { supabase, user } = await requirePortalAccess("canchas")

  const { data, error } = await supabase
    .from("canchas")
    .select("id, nombre, tipo, precio_hora, orden")
    .eq("agente_id", user.id)
    .eq("is_active", true)
    .order("orden")

  if (error) throw error
  return data ?? []
}
