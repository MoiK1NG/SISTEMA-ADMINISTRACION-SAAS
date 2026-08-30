import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pill, Repeat2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { estadoCaducidad, CADUCIDAD_META } from "@/lib/farmacia/caducidad"
import { LotesManager, type FilaLote } from "./_components/lotes-manager"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtFechaHora = (ts: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts))

const TIPO_MOV_LABEL: Record<string, string> = {
  entrada_venta:     "Entrada a venta",
  entrada_bodega:    "Entrada a bodega",
  traslado_a_venta:  "Bodega → Venta",
  traslado_a_bodega: "Venta → Bodega",
  merma_venta:       "Merma en venta",
  merma_bodega:      "Merma en bodega",
  salida_venta:      "Venta",
}

export default async function ProductoFarmaciaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, viendoA, negocio, rol } = await contextoFarmacia()
  if (!negocio) notFound()

  const { data: producto } = await supabase
    .from("productos_farmacia")
    .select(`id, codigo_barras, nombre, principio_activo, concentracion, presentacion,
      categoria, registro_invima, precio_venta, costo, requiere_receta, activo,
      laboratorios_farmacia(nombre), proveedores_farmacia(nombre)`)
    .eq("id", id).eq("negocio_id", negocio.id)
    .maybeSingle()

  if (!producto) notFound()

  const [{ data: lotesRaw }, { data: movimientos }, { data: equivalentesRaw }] = await Promise.all([
    supabase.from("lotes_farmacia")
      .select("id, lote, fecha_vencimiento, cantidad_venta, cantidad_bodega, estanteria")
      .eq("producto_id", id)
      .order("fecha_vencimiento"),           // FEFO: primero lo que vence antes
    supabase.from("movimientos_farmacia")
      .select("id, tipo, cantidad, motivo, created_at, lotes_farmacia(lote)")
      .eq("producto_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    producto.principio_activo
      ? supabase.from("productos_farmacia")
          .select("id, nombre, concentracion, precio_venta, stock_farmacia(stock_venta, stock_bodega)")
          .eq("negocio_id", negocio.id)
          .eq("principio_activo", producto.principio_activo)
          .eq("activo", true)
          .neq("id", id)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const esGestor = (rol === "dueno" || rol === "regente") && !viendoA

  const lotes: FilaLote[] = (lotesRaw ?? []).map((l: any) => ({
    id: l.id,
    lote: l.lote,
    fecha_vencimiento: l.fecha_vencimiento,
    cantidad_venta: Number(l.cantidad_venta),
    cantidad_bodega: Number(l.cantidad_bodega),
    estanteria: l.estanteria,
    semaforo: estadoCaducidad(l.fecha_vencimiento)!,
  }))

  const stockVenta  = lotes.reduce((s, l) => s + l.cantidad_venta, 0)
  const stockBodega = lotes.reduce((s, l) => s + l.cantidad_bodega, 0)

  const lab  = Array.isArray(producto.laboratorios_farmacia) ? producto.laboratorios_farmacia[0] : producto.laboratorios_farmacia
  const prov = Array.isArray(producto.proveedores_farmacia)  ? producto.proveedores_farmacia[0]  : producto.proveedores_farmacia

  const equivalentes = (equivalentesRaw ?? []).map((e: any) => {
    const st = Array.isArray(e.stock_farmacia) ? e.stock_farmacia[0] : e.stock_farmacia
    return {
      id: e.id, nombre: e.nombre, concentracion: e.concentracion,
      precio: Number(e.precio_venta),
      stock: Number(st?.stock_venta ?? 0) + Number(st?.stock_bodega ?? 0),
    }
  })

  const datos: [string, string | null][] = [
    ["Código de barras", producto.codigo_barras],
    ["Principio activo", producto.principio_activo],
    ["Presentación",     producto.presentacion],
    ["Laboratorio",      lab?.nombre ?? null],
    ["Proveedor",        prov?.nombre ?? null],
    ["Categoría",        producto.categoria],
    ["Registro INVIMA",  producto.registro_invima],
  ]

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/farmacia/inventario"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Inventario</span></Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10">
            <Pill className="h-4 w-4 text-teal-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-none text-slate-900">
              {producto.nombre} {producto.concentracion ?? ""}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {producto.codigo_barras ? <span className="font-mono">{producto.codigo_barras}</span> : "Sin código de barras"}
            </p>
          </div>
          {!producto.activo && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">Inactivo</span>
          )}
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Resumen ───────────────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {datos.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-400">{k}</span>
                  <span className={`text-right text-sm font-medium ${v ? "text-slate-800" : "text-slate-300"}`}>
                    {v ?? "—"}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 border-b border-slate-50 pb-2">
                <span className="text-xs text-slate-400">Requiere receta</span>
                <span className="text-sm font-medium text-slate-800">{producto.requiere_receta ? "Sí (Rx)" : "No"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Precio de venta</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{fmt(Number(producto.precio_venta))}</p>
              {esGestor && (
                <p className="mt-1 text-xs text-slate-400">
                  Costo {fmt(Number(producto.costo))} · margen{" "}
                  {Number(producto.precio_venta) > 0
                    ? Math.round(((Number(producto.precio_venta) - Number(producto.costo)) / Number(producto.precio_venta)) * 100)
                    : 0}%
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En venta</p>
                <p className={`mt-1 text-2xl font-black tabular-nums ${stockVenta <= 0 ? "text-rose-600" : "text-slate-900"}`}>{stockVenta}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En bodega</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{stockBodega}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Equivalentes ──────────────────────────────────────────────────── */}
        {equivalentes.length > 0 && (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-teal-900">
              <Repeat2 className="h-4 w-4" />
              Equivalentes ({producto.principio_activo})
            </p>
            <div className="flex flex-wrap gap-2">
              {equivalentes.map(e => (
                <Link
                  key={e.id}
                  href={`/portal/farmacia/inventario/${e.id}`}
                  className={`rounded-xl border bg-white px-3.5 py-2 text-sm shadow-sm transition-colors hover:border-teal-300 ${
                    e.stock > 0 ? "border-slate-200" : "border-slate-100 opacity-60"
                  }`}
                >
                  <span className="font-semibold text-slate-900">{e.nombre}</span>
                  {e.concentracion && <span className="ml-1 text-slate-400">{e.concentracion}</span>}
                  <span className="ml-2 text-xs text-slate-500">{fmt(e.precio)}</span>
                  <span className={`ml-2 text-xs font-bold ${e.stock > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {e.stock > 0 ? `${e.stock} disp.` : "sin stock"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Lotes (FEFO) ──────────────────────────────────────────────────── */}
        <LotesManager productoId={producto.id} lotes={lotes} esGestor={esGestor} />

        {/* ── Movimientos ───────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-50 px-5 py-4">
            <p className="text-sm font-bold text-slate-900">Movimientos recientes</p>
            <p className="mt-0.5 text-xs text-slate-400">Historial imborrable — los últimos 25</p>
          </div>
          {(movimientos ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sin movimientos todavía</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {(movimientos ?? []).map((m: any) => {
                    const loteRel = Array.isArray(m.lotes_farmacia) ? m.lotes_farmacia[0] : m.lotes_farmacia
                    const esResta = m.tipo.startsWith("merma") || m.tipo === "salida_venta" || m.tipo === "traslado_a_bodega"
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-400">{fmtFechaHora(m.created_at)}</td>
                        <td className="px-5 py-2.5 text-xs font-medium text-slate-700">{TIPO_MOV_LABEL[m.tipo] ?? m.tipo}</td>
                        <td className="px-5 py-2.5 text-xs text-slate-500">{loteRel?.lote ? `Lote ${loteRel.lote}` : "—"}</td>
                        <td className={`px-5 py-2.5 text-right text-sm font-bold tabular-nums ${esResta ? "text-rose-600" : "text-emerald-600"}`}>
                          {esResta ? "−" : "+"}{Number(m.cantidad)}
                        </td>
                        <td className="max-w-xs truncate px-5 py-2.5 text-xs text-slate-400">{m.motivo ?? ""}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
