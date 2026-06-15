import { requireClient } from "@/lib/supabase/require-client"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Landmark,
  User,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CircleDot,
  BanknoteIcon,
  Receipt,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { RegistrarPagoButton } from "./_components/registrar-pago-button"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type EstadoPrestamo = "pendiente" | "activo" | "al_dia" | "en_mora" | "pagado" | "cancelado"
type EstadoCuota    = "pendiente" | "pagado"  | "vencida" | "parcial"

interface Cuota {
  id: string
  numero: number
  fecha_vencimiento: string
  monto_cuota: number
  interes: number
  capital: number
  saldo_restante: number
  estado: EstadoCuota
  monto_pagado: number
}

interface Pago {
  id: string
  monto: number
  fecha: string
  nota: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso))
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

const ESTADO_PRESTAMO: Record<EstadoPrestamo, { label: string; icon: React.ElementType; classes: string }> = {
  pendiente: { label: "Pendiente", icon: Clock,         classes: "bg-amber-50  text-amber-700  border-amber-200"    },
  activo:    { label: "Activo",    icon: CheckCircle2,  classes: "bg-blue-50   text-blue-700   border-blue-200"     },
  al_dia:    { label: "Al día",    icon: CheckCircle2,  classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  en_mora:   { label: "En mora",   icon: AlertTriangle, classes: "bg-rose-50   text-rose-700   border-rose-200"     },
  pagado:    { label: "Pagado",    icon: CircleDot,     classes: "bg-slate-100 text-slate-600  border-slate-200"    },
  cancelado: { label: "Cancelado", icon: CircleDot,     classes: "bg-slate-100 text-slate-500  border-slate-200"    },
}

const ESTADO_CUOTA: Record<EstadoCuota, { label: string; classes: string }> = {
  pendiente: { label: "Pendiente", classes: "bg-amber-50  text-amber-700  border-amber-200"   },
  pagado:    { label: "Pagado",    classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  vencida:   { label: "Vencida",   classes: "bg-rose-50   text-rose-700   border-rose-200"    },
  parcial:   { label: "Parcial",   classes: "bg-sky-50    text-sky-700    border-sky-200"     },
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default async function PrestamoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ── Préstamo + cliente ────────────────────────────────────────────────────
  const { data: prestamo } = await supabase
    .from("prestamos")
    .select(`
      id, monto_principal, saldo_pendiente, tasa_interes,
      frecuencia, num_cuotas, estado, fecha_inicio,
      fecha_vencimiento, created_at,
      clientes ( id, nombre, cedula, telefono, direccion )
    `)
    .eq("id", id)
    .eq("agente_id", user.id)
    .single()

  if (!prestamo) notFound()

  // ── Cuotas (tabla de amortización) ───────────────────────────────────────
  const { data: cuotasRaw } = await supabase
    .from("cuotas")
    .select("id, numero, fecha_vencimiento, monto_cuota, interes, capital, saldo_restante, estado, monto_pagado")
    .eq("prestamo_id", id)
    .order("numero", { ascending: true })

  const cuotas: Cuota[] = (cuotasRaw ?? []).map((c) => ({
    ...c,
    monto_pagado: Number(c.monto_pagado ?? 0),
    monto_cuota:  Number(c.monto_cuota),
    interes:      Number(c.interes),
    capital:      Number(c.capital),
    saldo_restante: Number(c.saldo_restante),
  }))

  // ── Pagos registrados ─────────────────────────────────────────────────────
  const { data: pagosRaw } = await supabase
    .from("pagos")
    .select("id, monto, fecha, nota, created_at")
    .eq("prestamo_id", id)
    .order("created_at", { ascending: false })

  const pagos: Pago[] = (pagosRaw ?? []).map((p) => ({
    ...p,
    monto: Number(p.monto),
  }))

  const cliente      = Array.isArray(prestamo.clientes) ? prestamo.clientes[0] : prestamo.clientes
  const estadoCfg    = ESTADO_PRESTAMO[prestamo.estado as EstadoPrestamo] ?? ESTADO_PRESTAMO.activo
  const EstadoIcon   = estadoCfg.icon
  const cuotasPendientes = cuotas.filter((c) => c.estado !== "pagado")
  const proximaCuota     = cuotasPendientes[0] ?? null
  const cuotasPagadas    = cuotas.filter((c) => c.estado === "pagado").length
  const progreso         = cuotas.length > 0 ? Math.round((cuotasPagadas / cuotas.length) * 100) : 0
  const estaActivo       = ["activo", "al_dia", "en_mora", "pendiente"].includes(prestamo.estado)

  const FREC: Record<string, string> = {
    diario: "Diario", semanal: "Semanal", quincenal: "Quincenal", mensual: "Mensual",
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600 hover:text-slate-900">
            <Link href="/portal/prestamos">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Cartera</span>
            </Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Landmark className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-none truncate">
              {cliente?.nombre ?? "Préstamo"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 font-mono">{id.slice(0, 8).toUpperCase()}</p>
          </div>
          <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${estadoCfg.classes}`}>
            <EstadoIcon className="h-3 w-3" />
            {estadoCfg.label}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* ── RESUMEN DEL PRÉSTAMO ─────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Monto original",
              value: fmt(Number(prestamo.monto_principal)),
              sub: `${prestamo.num_cuotas} cuotas ${FREC[prestamo.frecuencia] ?? prestamo.frecuencia}`,
              icon: BanknoteIcon,
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "Saldo pendiente",
              value: fmt(Number(prestamo.saldo_pendiente)),
              sub: `Tasa: ${(Number(prestamo.tasa_interes) * 100).toFixed(2)}% por período`,
              icon: TrendingUp,
              color: "text-rose-600",
              bg: "bg-rose-50",
            },
            {
              label: "Progreso",
              value: `${progreso}%`,
              sub: `${cuotasPagadas} de ${cuotas.length} cuotas pagadas`,
              icon: CheckCircle2,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              label: "Total pagado",
              value: fmt(pagos.reduce((s, p) => s + p.monto, 0)),
              sub: `${pagos.length} pagos registrados`,
              icon: Receipt,
              color: "text-purple-600",
              bg: "bg-purple-50",
            },
          ].map((k) => (
            <Card key={k.label} className="border-slate-100 bg-white shadow-sm">
              <CardContent className="pt-5 flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{k.label}</p>
                  <p className="text-xl font-bold text-slate-900 leading-tight">{k.value}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{k.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{cuotasPagadas} cuotas pagadas</span>
            <span>{cuotasPendientes.length} pendientes</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── DATOS DEL CLIENTE ─────────────────────────────────────────── */}
          <Card className="border-slate-100 bg-white shadow-sm lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="h-4 w-4" /> Datos del cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(cliente?.nombre ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{cliente?.nombre}</p>
                  {cliente?.cedula && <p className="text-xs text-slate-400">{cliente.cedula}</p>}
                </div>
              </div>
              {cliente?.telefono && (
                <div className="text-xs text-slate-600">
                  <span className="text-slate-400">Tel: </span>{cliente.telefono}
                </div>
              )}
              {cliente?.direccion && (
                <div className="text-xs text-slate-600">
                  <span className="text-slate-400">Dir: </span>{cliente.direccion}
                </div>
              )}
              <div className="border-t border-slate-50 pt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Inicio</span>
                  <span>{fmtDate(prestamo.fecha_inicio)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vencimiento</span>
                  <span>{fmtDate(prestamo.fecha_vencimiento)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Frecuencia</span>
                  <span>{FREC[prestamo.frecuencia] ?? prestamo.frecuencia}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── PRÓXIMA CUOTA + ACCIÓN ───────────────────────────────────── */}
          <Card className="border-slate-100 bg-white shadow-sm lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Próxima cuota
              </CardTitle>
              <RegistrarPagoButton
                prestamoId={id}
                proximaCuota={proximaCuota ? { monto_cuota: proximaCuota.monto_cuota } : null}
                disabled={!estaActivo || !proximaCuota}
              />
            </CardHeader>
            <CardContent>
              {!proximaCuota ? (
                <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-4 border border-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Préstamo completado</p>
                    <p className="text-xs text-emerald-600">Todas las cuotas han sido pagadas</p>
                  </div>
                </div>
              ) : (
                <div className={`rounded-lg px-4 py-4 border ${
                  proximaCuota.estado === "vencida"
                    ? "bg-rose-50 border-rose-200"
                    : "bg-blue-50 border-blue-100"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-medium uppercase tracking-wider ${
                        proximaCuota.estado === "vencida" ? "text-rose-500" : "text-blue-500"
                      }`}>
                        Cuota #{proximaCuota.numero} · {(ESTADO_CUOTA[proximaCuota.estado as EstadoCuota])?.label ?? proximaCuota.estado}
                      </p>
                      <p className={`mt-1 text-2xl font-bold ${
                        proximaCuota.estado === "vencida" ? "text-rose-900" : "text-blue-900"
                      }`}>
                        {fmt(proximaCuota.monto_cuota)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs ${proximaCuota.estado === "vencida" ? "text-rose-500" : "text-blue-500"}`}>
                        Vence
                      </p>
                      <p className={`text-sm font-semibold ${
                        proximaCuota.estado === "vencida" ? "text-rose-700" : "text-blue-700"
                      }`}>
                        {fmtDate(proximaCuota.fecha_vencimiento)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className={proximaCuota.estado === "vencida" ? "text-rose-500" : "text-blue-500"}>Capital: </span>
                      <span className={`font-medium ${proximaCuota.estado === "vencida" ? "text-rose-800" : "text-blue-800"}`}>
                        {fmt(proximaCuota.capital)}
                      </span>
                    </div>
                    <div>
                      <span className={proximaCuota.estado === "vencida" ? "text-rose-500" : "text-blue-500"}>Interés: </span>
                      <span className={`font-medium ${proximaCuota.estado === "vencida" ? "text-rose-800" : "text-blue-800"}`}>
                        {fmt(proximaCuota.interes)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── TABLA DE AMORTIZACIÓN ────────────────────────────────────────── */}
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900">
              Tabla de amortización
              <span className="ml-2 text-xs font-normal text-slate-400">{cuotas.length} cuotas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {cuotas.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Sin cuotas generadas</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-50 hover:bg-transparent">
                      <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-12">#</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vencimiento</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cuota</TableHead>
                      <TableHead className="hidden sm:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">Capital</TableHead>
                      <TableHead className="hidden sm:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">Interés</TableHead>
                      <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">Saldo</TableHead>
                      <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cuotas.map((c) => {
                      const cfg = ESTADO_CUOTA[c.estado as EstadoCuota] ?? ESTADO_CUOTA.pendiente
                      return (
                        <TableRow key={c.id} className={`border-slate-50 transition-colors hover:bg-slate-50/70 ${c.estado === "vencida" ? "bg-rose-50/30" : ""}`}>
                          <TableCell className="pl-6">
                            <span className="text-xs font-mono font-medium text-slate-500">{String(c.numero).padStart(2, "0")}</span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm ${c.estado === "vencida" ? "text-rose-600 font-medium" : "text-slate-700"}`}>
                              {fmtDate(c.fecha_vencimiento)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-slate-900">{fmt(c.monto_cuota)}</span>
                            {c.estado === "parcial" && c.monto_pagado > 0 && (
                              <p className="text-[10px] text-sky-600">Pagado: {fmt(c.monto_pagado)}</p>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-slate-600">{fmt(c.capital)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-slate-600">{fmt(c.interes)}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-slate-500">{fmt(c.saldo_restante)}</TableCell>
                          <TableCell className="pr-6 text-right">
                            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${cfg.classes}`}>
                              {cfg.label}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── HISTORIAL DE PAGOS ───────────────────────────────────────────── */}
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900">
              Historial de pagos
              <span className="ml-2 text-xs font-normal text-slate-400">{pagos.length} registros</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pagos.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Receipt className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Sin pagos registrados aún</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fecha</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monto</TableHead>
                    <TableHead className="hidden sm:table-cell pr-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.map((p) => (
                    <TableRow key={p.id} className="border-slate-50 hover:bg-slate-50/70">
                      <TableCell className="pl-6">
                        <p className="text-sm text-slate-900">{fmtDate(p.fecha)}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {new Date(p.created_at).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-emerald-700">{fmt(p.monto)}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell pr-6 text-sm text-slate-500">
                        {p.nota ?? <span className="text-slate-300">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="h-6" />
      </main>
    </div>
  )
}
