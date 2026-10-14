"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Loader2, Printer, CalendarRange } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { anularVentaFarmacia } from "../../actions"
import { METODO_PAGO_LABEL, type MetodoPagoFarmacia } from "@/lib/farmacia/pos-constants"
import { fechaEnZona, sumarDias } from "@/lib/farmacia/formato"
import { useFormato, useNegocioUI } from "@/components/farmacia/negocio-provider"
import { ExportarCsv } from "@/components/farmacia/exportar-csv"
import { TicketVenta, type TicketData } from "@/components/farmacia/ticket-venta"

export interface FilaVenta {
  id:      string
  numero:  number
  total:   number
  estado:  "completada" | "anulada"
  creada:  string
  cliente: string | null
  motivo_anulacion: string | null
  items:   string[]
  lineas:  { nombre: string; cantidad: number; precio: number }[]
  pagos:   { metodo: string; monto: number }[]
}

export interface FilaEncargo {
  id:          string
  descripcion: string
  cantidad:    number
  total:       number
  pagado:      number
  estado:      string
  creada:      string
  cliente:     string
  pagos:       { metodo: string; monto: number; fecha: string }[]
}

const ESTADO_ENCARGO: Record<string, string> = {
  pagado: "Pagado", pedido: "Pedido", recibido: "Recibido",
  notificado: "Avisado", entregado: "Entregado", cancelado: "Cancelado",
}

interface Props {
  ventas:   FilaVenta[]
  encargos: FilaEncargo[]
  esGestor: boolean
  rango:    { desde: string; hasta: string }
  /** Hoy en la zona horaria del negocio ("YYYY-MM-DD") */
  hoy:      string
  /** Se alcanzó el tope de filas: hay más ventas que las mostradas */
  truncado: boolean
  limite:   number
}

export function VentasFarmacia({ ventas, encargos, esGestor, rango, hoy, truncado, limite }: Props) {
  const f = useFormato()
  const { moneda, negocio } = useNegocioUI()
  const router = useRouter()
  const [desde, setDesde] = useState(rango.desde)
  const [hasta, setHasta] = useState(rango.hasta)
  const [anulando, setAnulando] = useState<FilaVenta | null>(null)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [isPending, start] = useTransition()
  const [navegando, startNavegacion] = useTransition()

  const completadas = ventas.filter(v => v.estado === "completada")
  const ventasHoy = completadas.filter(v => fechaEnZona(v.creada, moneda) === hoy)
  const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0)
  const totalRango = completadas.reduce((s, v) => s + v.total, 0)
  const unDia = rango.desde === rango.hasta

  function aplicar(d: string, h: string) {
    startNavegacion(() => router.push(`/portal/farmacia/ventas?desde=${d}&hasta=${h}`))
  }

  const atajos = [
    { label: "Hoy",      d: hoy,                                   h: hoy },
    { label: "7 días",   d: sumarDias(hoy, -6),                    h: hoy },
    { label: "30 días",  d: sumarDias(hoy, -29),                   h: hoy },
    { label: "Este mes", d: hoy.slice(0, 8) + "01",                h: hoy },
  ]

  function confirmarAnulacion() {
    if (!anulando) return
    setError(null)
    start(async () => {
      try {
        await anularVentaFarmacia(anulando.id, motivo)
        setAnulando(null); setMotivo("")
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo anular") }
    })
  }

  function abrirTicket(v: FilaVenta) {
    setTicket({
      numero: v.numero, fecha: v.creada, total: v.total, vuelto: 0, cliente: v.cliente,
      anulada: v.estado === "anulada", lineas: v.lineas, pagos: v.pagos,
    })
  }

  const nombreArchivo = `ventas-${negocio.nombre.toLowerCase().replace(/\s+/g, "-") || "farmacia"}-${rango.desde}_${rango.hasta}.csv`

  return (
    <div className="space-y-5">
      {/* ── Rango de fechas ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-slate-400">Desde</Label>
            <Input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-slate-400">Hasta</Label>
            <Input type="date" value={hasta} min={desde} max={hoy} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
          </div>
          <Button size="sm" onClick={() => aplicar(desde, hasta)} disabled={navegando || !desde || !hasta}
                  className="h-9 gap-1.5 bg-brand-600 hover:bg-brand-700">
            {navegando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />}
            Aplicar
          </Button>
          <div className="flex flex-wrap gap-1.5">
            {atajos.map(a => (
              <button key={a.label} onClick={() => { setDesde(a.d); setHasta(a.h); aplicar(a.d, a.h) }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        rango.desde === a.d && rango.hasta === a.h
                          ? "bg-brand-600 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <ExportarCsv
          nombreArchivo={nombreArchivo}
          encabezados={["Número", "Fecha", "Estado", "Cliente", "Productos", "Pagos", "Total"]}
          filas={ventas.map(v => [
            v.numero,
            f.fechaHoraAnio(v.creada),
            v.estado === "anulada" ? `Anulada${v.motivo_anulacion ? ` (${v.motivo_anulacion})` : ""}` : "Completada",
            v.cliente ?? "",
            v.items.join(" | "),
            v.pagos.map(p => `${METODO_PAGO_LABEL[p.metodo as MetodoPagoFarmacia] ?? p.metodo} ${Math.round(p.monto)}`).join(" | "),
            Math.round(v.total),
          ])}
        />
      </div>

      {truncado && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Se muestran las últimas {limite} operaciones del período. Para ver todas, acota el rango de fechas.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hoy</p>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{f.dinero(totalHoy)}</p>
          <p className="text-xs text-slate-400">{ventasHoy.length} ventas</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {unDia ? f.fecha(rango.desde) : `${f.diaMes(rango.desde)} – ${f.diaMes(rango.hasta)}`}
          </p>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{f.dinero(totalRango)}</p>
          <p className="text-xs text-slate-400">{completadas.length} ventas</p>
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {ventas.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl">🧾</p>
            <p className="mt-2 text-sm font-medium text-slate-700">Sin ventas en el período</p>
            <p className="mt-1 text-xs text-slate-400">Las ventas del POS aparecen acá</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">#</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Items</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Cliente</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Pago</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ventas.map(v => (
                  <tr key={v.id} className={v.estado === "anulada" ? "bg-slate-50 opacity-60" : "hover:bg-slate-50/50"}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">#{v.numero}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{f.fechaHora(v.creada)}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-700">{v.items.join(", ")}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{v.cliente ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {v.pagos.map((p, i) => (
                          <span key={i} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {METODO_PAGO_LABEL[p.metodo as MetodoPagoFarmacia] ?? p.metodo} {f.dinero(p.monto)}
                          </span>
                        ))}
                      </div>
                      {v.estado === "anulada" && (
                        <p className="mt-1 text-[10px] font-semibold text-rose-500">
                          ANULADA{v.motivo_anulacion ? ` · ${v.motivo_anulacion}` : ""}
                        </p>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${v.estado === "anulada" ? "line-through" : "text-slate-900"}`}>
                      {f.dinero(v.total)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={() => abrirTicket(v)}
                        className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-brand-50 hover:text-brand-700"
                        title="Ver o imprimir comprobante"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {esGestor && v.estado === "completada" && (
                        <button
                          onClick={() => { setError(null); setMotivo(""); setAnulando(v) }}
                          className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Anular venta"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Anular una venta requiere autorización de dueño o regente, deja el motivo registrado y
        repone el stock a los mismos lotes de donde salió.
      </p>

      {/* ── Encargos y sus pagos ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 px-5 py-4">
          <p className="text-sm font-bold text-slate-900">Encargos del período</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Los pagos de encargos (anticipos y saldos al entregar) también entran al cierre de caja
          </p>
        </div>
        {encargos.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Sin encargos en el período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Encargo</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Cliente</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Pagos</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {encargos.map(p => {
                  const saldo = p.total - p.pagado
                  return (
                    <tr key={p.id} className={p.estado === "cancelado" ? "opacity-50" : "hover:bg-slate-50/50"}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{f.fechaHora(p.creada)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                        {p.cantidad > 1 ? `${p.cantidad}× ` : ""}{p.descripcion}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{p.cliente}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.estado === "entregado" ? "bg-emerald-50 text-emerald-700"
                          : p.estado === "cancelado" ? "bg-slate-100 text-slate-500"
                          : "bg-blue-50 text-blue-700"
                        }`}>
                          {ESTADO_ENCARGO[p.estado] ?? p.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.pagos.map((pg, i) => (
                            <span key={i} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              {METODO_PAGO_LABEL[pg.metodo as MetodoPagoFarmacia] ?? pg.metodo} {f.dinero(pg.monto)}
                            </span>
                          ))}
                          {saldo > 0.009 && p.estado !== "cancelado" && (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                              debe {f.dinero(saldo)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">{f.dinero(p.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comprobante */}
      <TicketVenta venta={ticket} open={ticket !== null} onOpenChange={v => { if (!v) setTicket(null) }} />

      {/* Dialog anulación */}
      <Dialog open={anulando !== null} onOpenChange={v => { if (!v) setAnulando(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Anular venta #{anulando?.numero}</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              {anulando?.items.join(", ")} · <strong>{anulando ? f.dinero(anulando.total) : ""}</strong>
              <p className="mt-1 text-slate-400">El stock vuelve a los mismos lotes de donde salió.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo (queda registrado) *</Label>
              <Input autoFocus placeholder="Ej: error de digitación, devolución…"
                     value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setAnulando(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={confirmarAnulacion}
                      disabled={isPending || !motivo.trim()}>
                {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Anulando…</> : "Anular venta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
