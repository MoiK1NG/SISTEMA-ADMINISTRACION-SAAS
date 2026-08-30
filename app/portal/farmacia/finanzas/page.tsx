import Link from "next/link"
import { Wallet, TrendingUp, Landmark, PackageOpen, Lock } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { METODO_PAGO_LABEL, type MetodoPagoFarmacia } from "@/lib/farmacia/pos-constants"
import { ExportarCsv } from "@/components/farmacia/exportar-csv"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtDia = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "2-digit" }).format(new Date(iso + "T12:00:00"))

export default async function FinanzasFarmaciaPage() {
  const { supabase, viendoA, negocio, rol } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  // Contabilidad general: SOLO el dueño (requisito explícito del cliente:
  // el regente no ve finanzas, el cajero menos)
  if (rol !== "dueno") {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-900">Finanzas del negocio</p>
          <p className="mt-1 text-sm text-slate-500">
            Esta sección es exclusiva del dueño: estados financieros, márgenes reales y flujo de caja.
          </p>
        </div>
      </div>
    )
  }

  // ── Datos del mes en curso ─────────────────────────────────────────────────
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
  const hoyStr = new Date().toISOString().split("T")[0]

  const [
    { data: ventasMes },
    { data: pagosMes },
    { data: pedidosMes },
    { data: cxpAbiertas },
    { data: pedidosAbiertos },
    { data: cierres },
  ] = await Promise.all([
    supabase.from("ventas_farmacia")
      .select("id, total, created_at, items_venta_farmacia(cantidad, precio_unitario, costo_unitario)")
      .eq("negocio_id", negocio.id).eq("estado", "completada")
      .gte("created_at", inicioMes.toISOString()),
    supabase.from("pagos_venta_farmacia")
      .select("metodo, monto, ventas_farmacia!inner(negocio_id, estado, created_at)")
      .eq("ventas_farmacia.negocio_id", negocio.id)
      .eq("ventas_farmacia.estado", "completada")
      .gte("ventas_farmacia.created_at", inicioMes.toISOString()),
    supabase.from("pedidos_farmacia")
      .select("monto_pagado, created_at")
      .eq("negocio_id", negocio.id).neq("estado", "cancelado").gt("monto_pagado", 0)
      .gte("created_at", inicioMes.toISOString()),
    supabase.from("cuentas_pagar_farmacia")
      .select("monto_total, monto_pagado")
      .eq("negocio_id", negocio.id).in("estado", ["pendiente", "parcial"]),
    supabase.from("pedidos_farmacia")
      .select("total, monto_pagado")
      .eq("negocio_id", negocio.id).in("estado", ["pagado", "pedido", "recibido", "notificado"]),
    supabase.from("cierres_caja_farmacia")
      .select("periodo_hasta, diferencia, num_ventas")
      .eq("negocio_id", negocio.id)
      .order("created_at", { ascending: false }).limit(5),
  ])

  // ── Cálculos ───────────────────────────────────────────────────────────────
  interface DiaResumen { fecha: string; ingreso: number; costo: number; ventas: number }
  const porDia = new Map<string, DiaResumen>()
  let ingresoMes = 0, costoMes = 0

  for (const v of ventasMes ?? []) {
    const fecha = String(v.created_at).split("T")[0]
    const items = (v as any).items_venta_farmacia ?? []
    const costo = items.reduce((s: number, i: any) => s + Number(i.costo_unitario) * Number(i.cantidad), 0)
    const d = porDia.get(fecha) ?? { fecha, ingreso: 0, costo: 0, ventas: 0 }
    d.ingreso += Number(v.total); d.costo += costo; d.ventas += 1
    porDia.set(fecha, d)
    ingresoMes += Number(v.total); costoMes += costo
  }

  const ingresoPedidosMes = (pedidosMes ?? []).reduce((s, p) => s + Number(p.monto_pagado), 0)
  const margenMes = ingresoMes - costoMes
  const margenPct = ingresoMes > 0 ? Math.round((margenMes / ingresoMes) * 100) : 0

  const ingresoHoy = porDia.get(hoyStr)?.ingreso ?? 0

  const porMetodo = new Map<string, number>()
  for (const p of pagosMes ?? []) {
    porMetodo.set(p.metodo, (porMetodo.get(p.metodo) ?? 0) + Number(p.monto))
  }
  const maxMetodo = Math.max(1, ...porMetodo.values())

  const deudaCxp = (cxpAbiertas ?? []).reduce((s, c) => s + Number(c.monto_total) - Number(c.monto_pagado), 0)
  const porCobrar = (pedidosAbiertos ?? []).reduce((s, p) => s + Number(p.total) - Number(p.monto_pagado), 0)

  const dias = [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const maxDia = Math.max(1, ...dias.map(d => d.ingreso))

  const kpis = [
    { label: "Vendido hoy",   valor: fmt(ingresoHoy),  sub: `${porDia.get(hoyStr)?.ventas ?? 0} ventas` },
    { label: "Vendido en el mes", valor: fmt(ingresoMes), sub: `${(ventasMes ?? []).length} ventas + ${fmt(ingresoPedidosMes)} en encargos` },
    { label: "Margen del mes", valor: fmt(margenMes),  sub: `${margenPct}% sobre la venta` },
    { label: "Debes / te deben", valor: `${fmt(deudaCxp)}`, sub: `por pagar · te deben ${fmt(porCobrar)}` },
  ]

  const nombreMes = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date())

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Finanzas</p>
            <p className="mt-0.5 text-xs capitalize text-slate-500">{negocio.nombre} · {nombreMes}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">

        {/* ── KPIs ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className="mt-1.5 text-xl font-black tabular-nums text-slate-900">{k.valor}</p>
              <p className="mt-0.5 text-xs text-slate-400">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Flujo por método ───────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Landmark className="h-4 w-4 text-teal-600" />Ingresos del mes por método
            </p>
            {porMetodo.size === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin ventas este mes</p>
            ) : (
              <div className="space-y-3">
                {[...porMetodo.entries()].sort((a, b) => b[1] - a[1]).map(([metodo, monto]) => (
                  <div key={metodo} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {METODO_PAGO_LABEL[metodo as MetodoPagoFarmacia] ?? metodo}
                      </span>
                      <span className="font-bold tabular-nums text-slate-900">{fmt(monto)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.round((monto / maxMetodo) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-slate-400">
                  Nota: el efectivo incluye lo pagado antes del vuelto; el neto real está en los cierres de caja.
                </p>
              </div>
            )}
          </div>

          {/* ── Últimos cierres ────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <PackageOpen className="h-4 w-4 text-teal-600" />Últimos cierres de caja
              </p>
              <Link href="/portal/farmacia/caja" className="text-xs font-medium text-teal-700 hover:underline">Ver todos</Link>
            </div>
            {(cierres ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin cierres todavía</p>
            ) : (
              <div className="space-y-2">
                {(cierres ?? []).map((c: any, i: number) => {
                  const dif = Number(c.diferencia?.total ?? 0)
                  return (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                      <span className="text-xs text-slate-500">
                        {new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(c.periodo_hasta))}
                        <span className="ml-2 text-slate-400">· {c.num_ventas} ventas</span>
                      </span>
                      <span className={`font-bold tabular-nums ${Math.abs(dif) < 0.01 ? "text-emerald-600" : dif > 0 ? "text-amber-600" : "text-rose-600"}`}>
                        {Math.abs(dif) < 0.01 ? "✓ Cuadró" : `${dif > 0 ? "+" : ""}${fmt(dif)}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Día a día del mes ──────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-50 px-5 py-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <TrendingUp className="h-4 w-4 text-teal-600" />Día a día · {nombreMes}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Venta, costo y margen — la base del reporte para tu contador</p>
            </div>
            <ExportarCsv
              nombreArchivo={`finanzas-${negocio.nombre.toLowerCase().replace(/\s+/g, "-")}-${hoyStr.slice(0, 7)}.csv`}
              encabezados={["Fecha", "Ventas", "Ingreso", "Costo", "Margen"]}
              filas={dias.map(d => [d.fecha, d.ventas, d.ingreso, Math.round(d.costo), Math.round(d.ingreso - d.costo)])}
            />
          </div>
          {dias.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Sin ventas este mes todavía</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Día</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-1/3">Ingreso</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Ventas</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Costo</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dias.map(d => {
                    const margen = d.ingreso - d.costo
                    return (
                      <tr key={d.fecha} className={`hover:bg-slate-50/50 ${d.fecha === hoyStr ? "bg-teal-50/40" : ""}`}>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium capitalize text-slate-700">
                          {fmtDia(d.fecha)}{d.fecha === hoyStr && <span className="ml-1.5 text-[10px] font-bold text-teal-600">HOY</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.round((d.ingreso / maxDia) * 100)}%` }} />
                            </div>
                            <span className="w-24 shrink-0 text-right text-xs font-bold tabular-nums">{fmt(d.ingreso)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-500">{d.ventas}</td>
                        <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-500">{fmt(d.costo)}</td>
                        <td className={`px-4 py-2.5 text-right text-xs font-bold tabular-nums ${margen >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {fmt(margen)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          El margen usa el costo registrado al momento de cada venta (no el costo actual del
          catálogo). Productos cargados sin costo aparecen con margen del 100%: completa el
          costo en el inventario para que el número sea real. La declaración de impuestos
          sigue siendo de tu contador — este reporte es su insumo, exportable arriba.
        </p>
      </main>
    </div>
  )
}
