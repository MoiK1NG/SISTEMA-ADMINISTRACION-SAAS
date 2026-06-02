// ─── Server Component ─────────────────────────────────────────────────────────
// Carga los datos en el servidor y pasa todo al Client Component.
// Cero interactividad aquí — sin "use client".

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Dumbbell } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CalendarioReservas, type Cancha, type Reserva } from "./_components/calendario-reservas"

// ─── Datos de demostración ────────────────────────────────────────────────────
// TODO: reemplazar con queries reales a las tablas `canchas` y `reservas`
const CANCHAS_MOCK: Cancha[] = [
  { id: "c1", nombre: "Cancha 1", tipo: "Fútbol 5  ·  Sintética",  color: "blue"    },
  { id: "c2", nombre: "Cancha 2", tipo: "Fútbol 7  ·  Sintética",  color: "emerald" },
  { id: "c3", nombre: "Cancha 3", tipo: "Fútbol 5  ·  Sintética",  color: "violet"  },
  { id: "c4", nombre: "Cancha 4", tipo: "Fútbol 11 ·  Natural",    color: "amber"   },
]

const RESERVAS_MOCK: Reserva[] = [
  { id: "r1",  canchaId: "c1", clienteNombre: "Carlos Méndez",      horaInicio: 16, horaFin: 17, estadoPago: "pagado",    monto: 1500 },
  { id: "r2",  canchaId: "c1", clienteNombre: "Equipo Los Primos",   horaInicio: 18, horaFin: 20, estadoPago: "debe_sena", monto: 3000 },
  { id: "r3",  canchaId: "c1", clienteNombre: "María González",      horaInicio: 21, horaFin: 22, estadoPago: "pagado",    monto: 1500 },
  { id: "r4",  canchaId: "c2", clienteNombre: "FC Barrio Norte",     horaInicio: 17, horaFin: 19, estadoPago: "pagado",    monto: 2800 },
  { id: "r5",  canchaId: "c2", clienteNombre: "Juan Pérez",          horaInicio: 20, horaFin: 21, estadoPago: "pendiente", monto: 1400 },
  { id: "r6",  canchaId: "c2", clienteNombre: "Empresa Torneo",      horaInicio: 22, horaFin: 23, estadoPago: "pagado",    monto: 1400 },
  { id: "r7",  canchaId: "c3", clienteNombre: "Los Cracks FC",       horaInicio: 16, horaFin: 18, estadoPago: "debe_sena", monto: 2200 },
  { id: "r8",  canchaId: "c3", clienteNombre: "Ana Rodríguez",       horaInicio: 19, horaFin: 20, estadoPago: "pagado",    monto: 1100 },
  { id: "r9",  canchaId: "c3", clienteNombre: "Peña Deportiva Sur",  horaInicio: 21, horaFin: 23, estadoPago: "pagado",    monto: 2200 },
  { id: "r10", canchaId: "c4", clienteNombre: "Torneo Empresarial",  horaInicio: 17, horaFin: 21, estadoPago: "pagado",    monto: 8000 },
  { id: "r11", canchaId: "c4", clienteNombre: "Club Deportivo Este", horaInicio: 22, horaFin: 23, estadoPago: "debe_sena", monto: 2000 },
]

// ─── Helper ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default async function CanchasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single()

  // Membresía activa
  const { data: membership } = await supabase
    .from("memberships")
    .select("end_date, membership_plans(name)")
    .eq("user_id", user.id)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const planName  = (membership?.membership_plans as any)?.name ?? "Plan Activo"
  const initials  = profile?.full_name ? getInitials(profile.full_name) : "U"
  const fechaHoy  = new Date().toISOString().split("T")[0]

  // TODO: calcular ingresos reales desde tabla `reservas`
  const ingresosDia = RESERVAS_MOCK
    .filter(r => r.estadoPago === "pagado")
    .reduce((s, r) => s + r.monto, 0)

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-500/30">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none text-slate-900">Canchas Sintéticas</p>
              <p className="mt-0.5 text-xs text-slate-500">Gestión de reservas</p>
            </div>
          </div>

          {/* Badge membresía + Avatar */}
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

      {/* ── CONTENIDO ───────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Título */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agenda de Reservas</h1>
          <p className="mt-1 text-sm text-slate-500">
            {CANCHAS_MOCK.length} canchas · Horario 4:00 PM – 11:00 PM
          </p>
        </div>

        {/* Calendario — Client Component con toda la interactividad */}
        <CalendarioReservas
          canchas={CANCHAS_MOCK}
          reservasIniciales={RESERVAS_MOCK}
          fechaInicial={fechaHoy}
          ingresosDia={ingresosDia}
        />

      </main>
    </div>
  )
}
