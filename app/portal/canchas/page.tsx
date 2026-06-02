// ─── Server Component ─────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Dumbbell } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CalendarioReservas } from "./_components/calendario-reservas"
import type { Cancha, Reserva } from "./types"

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

export default async function CanchasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ── Perfil ────────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single()

  // ── Membresía ─────────────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from("memberships")
    .select("end_date, membership_plans(name)")
    .eq("user_id", user.id)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Canchas del agente ────────────────────────────────────────────────────
  const { data: canchasRaw } = await supabase
    .from("canchas")
    .select("id, nombre, tipo, precio_hora, orden")
    .eq("agente_id", user.id)
    .eq("is_active", true)
    .order("orden")

  const canchas: Cancha[] = (canchasRaw ?? []).map(c => ({
    id:          c.id,
    nombre:      c.nombre,
    tipo:        c.tipo,
    precio_hora: c.precio_hora,
  }))

  // ── Reservas de hoy via función RPC ───────────────────────────────────────
  const fechaHoy = new Date().toISOString().split("T")[0]

  const { data: reservasRaw } = await supabase
    .rpc("reservas_del_dia", { p_fecha: fechaHoy })

  const reservas: Reserva[] = (reservasRaw ?? []).map((r: any) => ({
    id:              r.id,
    canchaId:        r.cancha_id,
    clienteNombre:   r.cliente_nombre,
    clienteTelefono: r.cliente_telefono,
    horaInicio:      r.hora_inicio,
    horaFin:         r.hora_fin,
    estadoPago:      r.estado_pago,
    estado:          r.estado,
    monto:           Number(r.monto),
    montoPagado:     Number(r.monto_pagado),
    nota:            r.nota,
  }))

  // ── KPI: ingresos del día (reservas pagadas) ──────────────────────────────
  const { data: kpi } = await supabase
    .from("kpis_canchas_agente")
    .select("ingresos_cobrados")
    .eq("agente_id", user.id)
    .eq("fecha", fechaHoy)
    .maybeSingle()

  const ingresosDia  = Number(kpi?.ingresos_cobrados ?? 0)
  const planName     = (membership?.membership_plans as any)?.name ?? "Plan Activo"
  const initials     = profile?.full_name ? getInitials(profile.full_name) : "U"

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-500/30">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none text-slate-900">Canchas Sintéticas</p>
              <p className="mt-0.5 text-xs text-slate-500">Gestión de reservas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700">{planName}</span>
            </div>
            <div className="hidden sm:block h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-slate-900 leading-none">{profile?.full_name ?? "Usuario"}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{profile?.email}</p>
              </div>
              <Avatar className="h-8 w-8 ring-2 ring-slate-100">
                <AvatarFallback className="bg-emerald-500/10 text-emerald-700 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agenda de Reservas</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canchas.length} {canchas.length === 1 ? "cancha" : "canchas"} · Horario 4:00 PM – 11:00 PM
          </p>
        </div>

        {canchas.length === 0 ? (
          // Estado vacío — sin canchas configuradas
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Dumbbell className="h-6 w-6 text-slate-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-900">Sin canchas configuradas</p>
            <p className="mt-1 text-xs text-slate-500 max-w-xs">
              Ejecuta el SQL de ejemplo para crear tus canchas, o agrégalas desde el panel de administración.
            </p>
          </div>
        ) : (
          <CalendarioReservas
            canchas={canchas}
            reservasIniciales={reservas}
            fechaInicial={fechaHoy}
            ingresosDia={ingresosDia}
          />
        )}
      </main>
    </div>
  )
}
