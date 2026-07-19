import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Banknote, AlertTriangle, CheckCircle2, Clock, CircleDot, TrendingDown, Users, Plus, ChevronRight, Search } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NuevoCobroButton } from "./_components/nuevo-cobro-button"
import { CobrosTable } from "./_components/cobros-table"

type EstadoCobro = "pendiente" | "parcial" | "pagado" | "vencido" | "cancelado"

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export const ESTADO_COBRO: Record<EstadoCobro, { label: string; icon: any; classes: string }> = {
  pendiente: { label: "Pendiente", icon: Clock,         classes: "bg-amber-50  text-amber-700  border-amber-200"    },
  parcial:   { label: "Parcial",   icon: TrendingDown,  classes: "bg-sky-50    text-sky-700    border-sky-200"      },
  pagado:    { label: "Pagado",    icon: CheckCircle2,  classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  vencido:   { label: "Vencido",   icon: AlertTriangle, classes: "bg-rose-50   text-rose-700   border-rose-200"     },
  cancelado: { label: "Cancelado", icon: CircleDot,     classes: "bg-slate-100 text-slate-500  border-slate-200"    },
}

export default async function CobrosPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles").select("full_name, email").eq("id", user.id).single()

  const { data: membership } = await supabase
    .from("memberships").select("end_date, membership_plans(name)")
    .eq("user_id", user.id).gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: false }).limit(1).maybeSingle()

  // KPIs
  const { data: kpiRaw } = await supabase
    .from("kpis_cobros").select("*").eq("agente_id", user.id).maybeSingle()

  const kpi = {
    total_facturado:   Number(kpiRaw?.total_facturado   ?? 0),
    total_cobrado:     Number(kpiRaw?.total_cobrado     ?? 0),
    saldo_por_cobrar:  Number(kpiRaw?.saldo_por_cobrar  ?? 0),
    cobros_vencidos:   Number(kpiRaw?.cobros_vencidos   ?? 0),
    monto_vencido:     Number(kpiRaw?.monto_vencido     ?? 0),
    total_cobros:      Number(kpiRaw?.total_cobros      ?? 0),
  }

  // Cobros con cliente
  const { data: cobrosRaw } = await supabase
    .from("cobros")
    .select("id, descripcion, monto_total, monto_pagado, saldo_pendiente, estado, fecha_vencimiento, created_at, clientes_cobro(nombre)")
    .eq("agente_id", user.id)
    .order("created_at", { ascending: false })

  const cobros = (cobrosRaw ?? []).map((c) => ({
    ...c,
    monto_total:      Number(c.monto_total),
    monto_pagado:     Number(c.monto_pagado),
    saldo_pendiente:  Number(c.saldo_pendiente),
    cliente: Array.isArray(c.clientes_cobro) ? c.clientes_cobro[0] ?? null : c.clientes_cobro,
  }))

  const initials = profile?.full_name ? getInitials(profile.full_name) : "U"
  const planName = (membership?.membership_plans as any)?.name ?? "Plan Activo"
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"
  const cobrosActivos = cobros.filter(c => !["pagado","cancelado"].includes(c.estado)).length

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-sm shadow-emerald-500/30">
              <Banknote className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none text-slate-900">Cobros</p>
              <p className="mt-0.5 text-xs text-slate-500">Cuentas por cobrar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-slate-600 hover:text-slate-900">
              <Link href="/portal/cobros/clientes"><Users className="h-4 w-4" />Clientes</Link>
            </Button>
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700">{planName}</span>
            </div>
            <div className="hidden sm:block h-5 w-px bg-slate-200" />
            <Avatar className="h-8 w-8 ring-2 ring-slate-100">
              <AvatarFallback className="bg-emerald-600/10 text-emerald-700 text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{greeting}, {profile?.full_name?.split(" ")[0] ?? "bienvenido"}</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Portal de Cobros</h1>
          </div>
          <NuevoCobroButton />
        </div>

        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Facturado",   value: fmt(kpi.total_facturado),  sub: `${kpi.total_cobros} cobros en total`,          icon: Banknote,       bg: "bg-blue-50",   color: "text-blue-600"    },
            { label: "Total Cobrado",     value: fmt(kpi.total_cobrado),    sub: `${cobros.filter(c=>c.estado==='pagado').length} cobros saldados`, icon: CheckCircle2,  bg: "bg-emerald-50", color: "text-emerald-600" },
            { label: "Por Cobrar",        value: fmt(kpi.saldo_por_cobrar), sub: `${cobrosActivos} cobros activos`,              icon: Clock,          bg: "bg-amber-50",  color: "text-amber-600"   },
            { label: "Monto Vencido",     value: fmt(kpi.monto_vencido),    sub: `${kpi.cobros_vencidos} cobros vencidos`,       icon: AlertTriangle,  bg: "bg-rose-50",   color: "text-rose-600"    },
          ].map((k) => (
            <Card key={k.label} className="group border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">{k.label}</CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                <p className="mt-1 text-xs text-slate-500">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Tabla */}
        <section>
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Cobros</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">{cobros.length} registros en total</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-500">
                  <Link href="/portal/cobros/clientes"><Users className="h-3.5 w-3.5" />Ver clientes</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className={cobros.length === 0 ? "p-0" : "pt-4 px-6 pb-6"}>
              {cobros.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Banknote className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-900">Sin cobros aún</p>
                  <p className="mt-1 text-xs text-slate-500">Crea tu primer cobro con el botón de arriba.</p>
                </div>
              ) : (
                <CobrosTable cobros={cobros} />
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
