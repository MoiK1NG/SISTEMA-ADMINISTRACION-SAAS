import { requireClient } from "@/lib/supabase/require-client"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  TrendingUp, Store, Croissant, UtensilsCrossed, Dumbbell,
  Landmark, Banknote, Trophy, Info,
} from "lucide-react"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtNum = (n: number) => new Intl.NumberFormat("es-CO").format(n)

const fmtFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(new Date(iso))

/** Un movimiento normalizado, venga del portal que venga. */
interface Movimiento {
  agente: string
  monto:  number
  fecha:  string   // YYYY-MM-DD
  portal: string
}

const PORTAL_META: Record<string, { nombre: string; icon: any; color: string }> = {
  panaderia:   { nombre: "Panadería",   icon: Croissant,      color: "#f97316" },
  pos:         { nombre: "Punto de Venta", icon: Store,       color: "#8b5cf6" },
  restaurante: { nombre: "Restaurante", icon: UtensilsCrossed, color: "#ef4444" },
  canchas:     { nombre: "Canchas",     icon: Dumbbell,       color: "#10b981" },
}

export default async function ActividadPage() {
  const supabase = await requireClient()

  const hoy = new Date().toISOString().split("T")[0]
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  const hace30ts = new Date(Date.now() - 30 * 86400000).toISOString()

  // La RLS deja al admin leer las filas de todos los agentes, así que estas
  // consultas devuelven el movimiento de la plataforma completa.
  const [
    { data: perfiles },
    { data: ventasPan },
    { data: ventasPos },
    { data: pagosRest },
    { data: reservas },
    { data: prestamos },
    { data: cobros },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role"),
    supabase.from("ventas_pan").select("agente_id, total, fecha").gte("fecha", hace30),
    supabase.from("ventas_pos").select("agente_id, total, created_at").gte("created_at", hace30ts),
    supabase.from("pagos_rest").select("agente_id, monto, created_at").gte("created_at", hace30ts),
    supabase.from("reservas").select("agente_id, monto_pagado, fecha").gte("fecha", hace30).neq("estado", "cancelada"),
    supabase.from("prestamos").select("agente_id, monto_principal, saldo_pendiente, estado"),
    supabase.from("cobros").select("agente_id, monto_total, saldo_pendiente, estado"),
  ])

  const nombrePorId = new Map(
    (perfiles ?? []).map(p => [p.id, p.full_name || p.email || "Sin nombre"])
  )

  // ── Normalizar todo a una sola lista ──────────────────────────────────────
  const movimientos: Movimiento[] = [
    ...(ventasPan ?? []).map(v => ({
      agente: v.agente_id, monto: Number(v.total), fecha: v.fecha, portal: "panaderia",
    })),
    ...(ventasPos ?? []).map(v => ({
      agente: v.agente_id, monto: Number(v.total), fecha: String(v.created_at).split("T")[0], portal: "pos",
    })),
    ...(pagosRest ?? []).map(p => ({
      agente: p.agente_id, monto: Number(p.monto), fecha: String(p.created_at).split("T")[0], portal: "restaurante",
    })),
    ...(reservas ?? []).map(r => ({
      agente: r.agente_id, monto: Number(r.monto_pagado), fecha: r.fecha, portal: "canchas",
    })),
  ].filter(m => m.monto > 0)

  // ── Totales de la plataforma ──────────────────────────────────────────────
  const totalHoy   = movimientos.filter(m => m.fecha === hoy).reduce((s, m) => s + m.monto, 0)
  const total30    = movimientos.reduce((s, m) => s + m.monto, 0)
  const transacciones = movimientos.length
  const ticket     = transacciones > 0 ? total30 / transacciones : 0
  const negociosActivos = new Set(movimientos.map(m => m.agente)).size

  // ── Por portal ────────────────────────────────────────────────────────────
  const porPortal = Object.keys(PORTAL_META).map(slug => {
    const propios = movimientos.filter(m => m.portal === slug)
    return {
      slug,
      total:     propios.reduce((s, m) => s + m.monto, 0),
      cantidad:  propios.length,
      negocios:  new Set(propios.map(m => m.agente)).size,
    }
  }).sort((a, b) => b.total - a.total)

  const maxPortal = Math.max(1, ...porPortal.map(p => p.total))

  // ── Ranking de negocios ───────────────────────────────────────────────────
  const porNegocio = [...new Set(movimientos.map(m => m.agente))].map(agente => {
    const propios = movimientos.filter(m => m.agente === agente)
    const portales = [...new Set(propios.map(m => m.portal))]
    return {
      agente,
      nombre:    nombrePorId.get(agente) ?? "Usuario eliminado",
      total:     propios.reduce((s, m) => s + m.monto, 0),
      cantidad:  propios.length,
      portales,
      ultima:    propios.map(m => m.fecha).sort().reverse()[0],
    }
  }).sort((a, b) => b.total - a.total)

  // ── Cartera (préstamos y cobros: son saldos, no ventas) ───────────────────
  const activosPrestamo = (prestamos ?? []).filter(p => !["pagado", "cancelado"].includes(p.estado))
  const carteraPrestamos = activosPrestamo.reduce((s, p) => s + Number(p.saldo_pendiente), 0)
  const enMora = (prestamos ?? []).filter(p => p.estado === "en_mora")
  const moraMonto = enMora.reduce((s, p) => s + Number(p.saldo_pendiente), 0)

  const cobrosAbiertos = (cobros ?? []).filter(c => !["pagado", "cancelado"].includes(c.estado))
  const porCobrar = cobrosAbiertos.reduce((s, c) => s + Number(c.saldo_pendiente), 0)

  const kpis = [
    { label: "Facturado hoy",     valor: fmt(totalHoy),  sub: "todos los negocios",              color: "text-emerald-600" },
    { label: "Facturado 30 días", valor: fmt(total30),   sub: `${fmtNum(transacciones)} transacciones`, color: "text-blue-600" },
    { label: "Negocios activos",  valor: String(negociosActivos), sub: "con ventas en 30 días",   color: "text-violet-600" },
    { label: "Ticket promedio",   valor: fmt(ticket),    sub: "por transacción",                  color: "text-amber-600" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TrendingUp className="h-6 w-6" /> Actividad de los negocios
        </h1>
        <p className="text-sm text-muted-foreground">
          Movimiento consolidado de todos tus clientes en los últimos 30 días
        </p>
      </div>

      {/* ── KPIs de plataforma ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className={`mt-1.5 text-2xl font-black ${k.color}`}>{k.valor}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {movimientos.length === 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 pt-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="font-semibold text-blue-900">Todavía no hay movimiento</p>
              <p className="mt-1 text-sm text-blue-700">
                Cuando tus clientes registren ventas en Panadería, Punto de Venta, Restaurante
                o Canchas, acá vas a ver el consolidado y el ranking.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Por portal ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Facturación por portal · 30 días</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {porPortal.map(p => {
            const meta = PORTAL_META[p.slug]
            const pct = Math.round((p.total / maxPortal) * 100)
            return (
              <div key={p.slug} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <meta.icon className="h-4 w-4" style={{ color: meta.color }} />
                    {meta.nombre}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span>{p.negocios} {p.negocios === 1 ? "negocio" : "negocios"}</span>
                    <span>{fmtNum(p.cantidad)} mov.</span>
                    <span className="w-28 text-right font-bold tabular-nums text-foreground">{fmt(p.total)}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all"
                       style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Ranking de negocios ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" /> Ranking de negocios · 30 días
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {porNegocio.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Sin ventas registradas en el período
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Negocio</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Portales</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mov.</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Última venta</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Facturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {porNegocio.map((n, i) => (
                    <tr key={n.agente} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs font-bold text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold">{n.nombre}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {n.portales.map(s => {
                            const meta = PORTAL_META[s]
                            return (
                              <span key={s} title={meta.nombre}
                                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                    style={{ borderColor: meta.color + "55", color: meta.color }}>
                                <meta.icon className="h-2.5 w-2.5" />
                                {meta.nombre}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">{fmtNum(n.cantidad)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtFecha(n.ultima)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(n.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Cartera: préstamos y cobros ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4 text-blue-600" /> Préstamos · cartera total
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo por cobrar</span>
              <span className="font-bold tabular-nums">{fmt(carteraPrestamos)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Préstamos activos</span>
              <span className="font-medium tabular-nums">{fmtNum(activosPrestamo.length)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">En mora</span>
              <span className="font-bold tabular-nums text-rose-600">
                {fmtNum(enMora.length)} · {fmt(moraMonto)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4 text-emerald-600" /> Cobros · por cobrar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo pendiente</span>
              <span className="font-bold tabular-nums">{fmt(porCobrar)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cobros abiertos</span>
              <span className="font-medium tabular-nums">{fmtNum(cobrosAbiertos.length)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Para revisar un negocio en detalle, entra a{" "}
        <Link href="/admin/users" className="font-medium text-blue-600 hover:underline">Usuarios</Link>{" "}
        y usa <em>Ver sus portales</em>. Los montos de Préstamos y Cobros son saldos de
        cartera, no facturación, por eso van aparte.
      </p>
    </div>
  )
}
