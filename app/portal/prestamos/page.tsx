// ─── Server Component ────────────────────────────────────────────────────────
import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CircleDot,
  TrendingUp,
  Landmark,
  ArrowUpRight,
  Users,
  Wallet,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NuevoPrestamoButton } from "./_components/nuevo-prestamo-button"
import { PrestamosTable } from "./_components/prestamos-table"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type EstadoPrestamo = "pendiente" | "activo" | "al_dia" | "en_mora" | "pagado" | "cancelado"

interface PrestamoRow {
  id: string
  monto_principal: number
  saldo_pendiente: number
  estado: EstadoPrestamo
  fecha_vencimiento: string
  created_at: string
  clientes: { nombre: string } | null
  proxima_cuota: { fecha_vencimiento: string; monto_cuota: number } | null
}

interface KpiAgente {
  total_prestado:      number
  capital_recuperado:  number
  prestamos_en_mora:   number
  monto_en_mora:       number
  cartera_vigente:     number
  total_prestamos:     number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(amount: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Config estados ───────────────────────────────────────────────────────────
const ESTADO: Record<EstadoPrestamo, { label: string; icon: React.ElementType; classes: string }> = {
  pendiente:  { label: "Pendiente",  icon: Clock,         classes: "bg-amber-50  text-amber-700  border-amber-200"  },
  activo:     { label: "Activo",     icon: CheckCircle2,  classes: "bg-blue-50   text-blue-700   border-blue-200"   },
  al_dia:     { label: "Al día",     icon: CheckCircle2,  classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  en_mora:    { label: "En mora",    icon: AlertTriangle, classes: "bg-rose-50   text-rose-700   border-rose-200"   },
  pagado:     { label: "Pagado",     icon: CircleDot,     classes: "bg-slate-100 text-slate-600  border-slate-200"  },
  cancelado:  { label: "Cancelado",  icon: CircleDot,     classes: "bg-slate-100 text-slate-500  border-slate-200"  },
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default async function PrestamosPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ── Perfil ────────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single()

  // ── Membresía activa ──────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from("memberships")
    .select("end_date, membership_plans(name)")
    .eq("user_id", user.id)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── KPIs desde la vista ───────────────────────────────────────────────────
  const { data: kpiRaw } = await supabase
    .from("kpis_agente")
    .select("*")
    .eq("agente_id", user.id)
    .maybeSingle()

  const kpi: KpiAgente = {
    total_prestado:     Number(kpiRaw?.total_prestado     ?? 0),
    capital_recuperado: Number(kpiRaw?.capital_recuperado ?? 0),
    prestamos_en_mora:  Number(kpiRaw?.prestamos_en_mora  ?? 0),
    monto_en_mora:      Number(kpiRaw?.monto_en_mora      ?? 0),
    cartera_vigente:    Number(kpiRaw?.cartera_vigente    ?? 0),
    total_prestamos:    Number(kpiRaw?.total_prestamos    ?? 0),
  }

  const recuperacionRatio = kpi.total_prestado > 0
    ? Math.min(100, Math.round((kpi.capital_recuperado / kpi.total_prestado) * 100))
    : 0

  // ── Préstamos recientes (últimos 8) ───────────────────────────────────────
  const { data: prestamosRaw } = await supabase
    .from("prestamos")
    .select(`
      id,
      monto_principal,
      saldo_pendiente,
      estado,
      fecha_vencimiento,
      created_at,
      clientes ( nombre )
    `)
    .eq("agente_id", user.id)
    .order("created_at", { ascending: false })

  // Para cada préstamo, obtener la próxima cuota pendiente/vencida
  const prestamosIds = (prestamosRaw ?? []).map((p) => p.id)

  const { data: proximasCuotas } = prestamosIds.length > 0
    ? await supabase
        .from("cuotas")
        .select("prestamo_id, fecha_vencimiento, monto_cuota")
        .in("prestamo_id", prestamosIds)
        .in("estado", ["pendiente", "vencida", "parcial"])
        .order("numero", { ascending: true })
    : { data: [] }

  // Mapa prestamo_id → primera cuota pendiente
  const cuotaMap = new Map<string, { fecha_vencimiento: string; monto_cuota: number }>()
  for (const c of proximasCuotas ?? []) {
    if (!cuotaMap.has(c.prestamo_id)) cuotaMap.set(c.prestamo_id, c)
  }

  const prestamos: PrestamoRow[] = (prestamosRaw ?? []).map((p) => ({
    ...p,
    clientes: Array.isArray(p.clientes) ? p.clientes[0] ?? null : p.clientes,
    proxima_cuota: cuotaMap.get(p.id) ?? null,
  }))

  // ── Datos de cabecera ─────────────────────────────────────────────────────
  const initials  = profile?.full_name ? getInitials(profile.full_name) : "U"
  const planName  = (membership?.membership_plans as any)?.name ?? "Plan Activo"
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm shadow-primary/30">
              <Landmark className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none text-slate-900">Préstamos Express</p>
              <p className="mt-0.5 text-xs text-slate-500">Portal de créditos</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-slate-600 hover:text-slate-900">
              <Link href="/portal/prestamos/clientes">
                <Users className="h-4 w-4" />
                Clientes
              </Link>
            </Button>
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
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

        {/* Título + CTA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{greeting}, {profile?.full_name?.split(" ")[0] ?? "bienvenido"}</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cartera de Préstamos</h1>
          </div>
          <NuevoPrestamoButton />
        </div>

        {/* ── KPIs ──────────────────────────────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Total Prestado */}
          <Card className="group border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Prestado
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{fmt(kpi.total_prestado)}</p>
              <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                <span>{kpi.total_prestamos} préstamos en cartera</span>
              </div>
            </CardContent>
          </Card>

          {/* Capital Recuperado */}
          <Card className="group border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Capital Recuperado
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{fmt(kpi.capital_recuperado)}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${recuperacionRatio}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-emerald-600">{recuperacionRatio}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Cuotas en Mora */}
          <Card className="group border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Cuotas en Mora
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 group-hover:bg-rose-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-slate-900">{kpi.prestamos_en_mora}</p>
                <span className="mb-0.5 text-sm text-slate-500">préstamos</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-rose-600">
                {kpi.prestamos_en_mora > 0 && (
                  <><AlertTriangle className="h-3 w-3" /><span>{fmt(kpi.monto_en_mora)} en exposición</span></>
                )}
                {kpi.prestamos_en_mora === 0 && (
                  <span className="text-emerald-600">✓ Sin mora actualmente</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cartera Vigente */}
          <Card className="group border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Cartera Vigente
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 group-hover:bg-purple-100 transition-colors">
                <Wallet className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{fmt(kpi.cartera_vigente)}</p>
              <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                <span>Saldo activo por cobrar</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── TABLA ─────────────────────────────────────────────────────── */}
        <section>
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Cartera de Préstamos</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">{prestamos.length} préstamos en total</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-500 hover:text-slate-900">
                  <Link href="/portal/prestamos/clientes">
                    <Users className="h-3.5 w-3.5" />
                    Ver clientes
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className={prestamos.length === 0 ? "p-0" : "p-0 pt-4 px-6 pb-6"}>
              {prestamos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Landmark className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-900">Sin préstamos aún</p>
                  <p className="mt-1 text-xs text-slate-500">Crea tu primer préstamo con el botón de arriba.</p>
                </div>
              ) : (
                <PrestamosTable prestamos={prestamos} />
              )}
            </CardContent>
          </Card>
        </section>

        <div className="h-6 sm:hidden" />
      </main>
    </div>
  )
}
