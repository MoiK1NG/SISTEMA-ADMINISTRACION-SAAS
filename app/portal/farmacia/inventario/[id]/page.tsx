import { formato } from "@/lib/farmacia/formato"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pill, Repeat2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { estadoCaducidad } from "@/lib/farmacia/caducidad"
import { costoConIva, margen } from "@/lib/farmacia/formato"
import { LotesManager, type FilaLote } from "./_components/lotes-manager"

/** Nombres legibles de los campos que registra el historial de cambios */
const CAMPO_LABEL: Record<string, string> = {
  creado: "Producto creado", nombre: "Nombre", principio_activo: "Principio activo",
  concentracion: "Concentración", presentacion: "Presentación", categoria: "Categoría",
  codigo_barras: "Código de barras", registro_invima: "Registro sanitario",
  precio_venta: "Precio de venta", costo: "Costo neto", iva_pct: "IVA %",
  requiere_receta: "Requiere receta", activo: "Activo", laboratorio_id: "Laboratorio", proveedor_id: "Proveedor",
}

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
  const f = formato(negocio?.moneda)
  if (!negocio) notFound()

  const { data: producto } = await supabase
    .from("productos_farmacia")
    .select(`id, codigo_barras, nombre, principio_activo, concentracion, presentacion,
      categoria, registro_invima, precio_venta, costo, iva_pct, requiere_receta, activo,
      laboratorios_farmacia(nombre), proveedores_farmacia(nombre)`)
    .eq("id", id).eq("negocio_id", negocio.id)
    .maybeSingle()

  if (!producto) notFound()

  const esGestor = (rol === "dueno" || rol === "regente") && !viendoA

  const [{ data: lotesRaw }, { data: movimientos }, { data: equivalentesRaw }, { data: historialRaw }, { data: equipo }] = await Promise.all([
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
    // Historial de cambios: solo gestores (la RLS también lo limita)
    esGestor
      ? supabase.from("historial_productos_farmacia")
          .select("id, campo, valor_anterior, valor_nuevo, created_at, user_id")
          .eq("producto_id", id)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as any[] }),
    // Nombres del equipo, para firmar cada cambio del historial
    esGestor
      ? supabase.rpc("equipo_negocio", { p_negocio: negocio.id })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const nombrePorUsuario = new Map<string, string>((equipo ?? []).map((m: any) => [m.user_id, m.nombre]))

  const lotes: FilaLote[] = (lotesRaw ?? []).map((l: any) => ({
    id: l.id,
    lote: l.lote,
    fecha_vencimiento: l.fecha_vencimiento,
    cantidad_venta: Number(l.cantidad_venta),
    cantidad_bodega: Number(l.cantidad_bodega),
    estanteria: l.estanteria,
    semaforo: estadoCaducidad(l.fecha_vencimiento, true)!,
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

  // Principio activo con su concentración al lado (pedido del equipo)
  const principio = [producto.principio_activo, producto.concentracion].filter(Boolean).join(" ") || null
  const precio    = Number(producto.precio_venta)
  const costoNeto = Number(producto.costo)
  const ivaPct    = Number(producto.iva_pct ?? 0)
  const costoIva  = costoConIva(costoNeto, ivaPct)
  const mg        = margen(precio, costoNeto, ivaPct)

  const datos: [string, string | null][] = [
    ["Código de barras",     producto.codigo_barras],
    ["Principio(s) activo(s)", principio],
    ["Presentación",         producto.presentacion],
    ["Laboratorio",      lab?.nombre ?? null],
    ["Proveedor",        prov?.nombre ?? null],
    ["Categoría",        producto.categoria],
    ["Registro sanitario",  producto.registro_invima],
  ]

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/farmacia/inventario"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Inventario</span></Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/10">
            <Pill className="h-4 w-4 text-brand-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-none text-slate-900">
              {producto.nombre}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {principio ?? "Sin principio activo"}
              {" · "}
              {producto.codigo_barras ? <span className="font-mono">{producto.codigo_barras}</span> : "sin código de barras"}
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
              <p className="mt-1 text-2xl font-black text-slate-900">{f.dinero(precio)}</p>
              {esGestor && (
                <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                  <p>Costo neto {f.dinero(costoNeto)}{ivaPct > 0 && <> + IVA {ivaPct}% = <strong className="text-slate-700">{f.dinero(costoIva)}</strong></>}</p>
                  <p>
                    Utilidad por unidad <strong className="text-slate-700">{f.dinero(precio - costoIva)}</strong>
                    {" · "}margen{" "}
                    <strong className={mg == null ? "text-slate-400" : mg < 0 ? "text-rose-600" : mg < 0.15 ? "text-amber-600" : "text-emerald-600"}>
                      {mg == null ? "—" : f.porcentaje(mg)}
                    </strong>
                  </p>
                </div>
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
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-900">
              <Repeat2 className="h-4 w-4" />
              Equivalentes ({producto.principio_activo})
            </p>
            <div className="flex flex-wrap gap-2">
              {equivalentes.map(e => (
                <Link
                  key={e.id}
                  href={`/portal/farmacia/inventario/${e.id}`}
                  className={`rounded-xl border bg-white px-3.5 py-2 text-sm shadow-sm transition-colors hover:border-brand-300 ${
                    e.stock > 0 ? "border-slate-200" : "border-slate-100 opacity-60"
                  }`}
                >
                  <span className="font-semibold text-slate-900">{e.nombre}</span>
                  {e.concentracion && <span className="ml-1 text-slate-400">{e.concentracion}</span>}
                  <span className="ml-2 text-xs text-slate-500">{f.dinero(e.precio)}</span>
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

        {/* ── Historial de cambios (solo gestores) ──────────────────────────── */}
        {esGestor && (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 px-5 py-4">
              <p className="text-sm font-bold text-slate-900">Historial de cambios</p>
              <p className="mt-0.5 text-xs text-slate-400">Quién cambió qué y cuándo — los últimos 30</p>
            </div>
            {(historialRaw ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin cambios registrados todavía</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    {(historialRaw ?? []).map((h: any) => (
                      <tr key={h.id} className="hover:bg-slate-50/50">
                        <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-400">{f.fechaHora(h.created_at)}</td>
                        <td className="px-5 py-2.5 text-xs font-medium text-slate-700">{CAMPO_LABEL[h.campo] ?? h.campo}</td>
                        <td className="px-5 py-2.5 text-xs text-slate-500">
                          {h.campo === "creado" ? (
                            <span className="text-slate-700">{h.valor_nuevo}</span>
                          ) : (
                            <>
                              <span className="line-through decoration-slate-300">{h.valor_anterior ?? "—"}</span>
                              <span className="mx-1.5 text-slate-300">→</span>
                              <span className="font-semibold text-slate-800">{h.valor_nuevo ?? "—"}</span>
                            </>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right text-[11px] text-slate-400">
                          {nombrePorUsuario.get(h.user_id) ?? (h.user_id ? "—" : "Carga por sistema")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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
                        <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-400">{f.fechaHora(m.created_at)}</td>
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
