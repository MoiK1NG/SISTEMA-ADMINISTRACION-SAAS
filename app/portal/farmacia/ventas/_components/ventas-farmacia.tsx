"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { anularVentaFarmacia } from "../../actions"
import { METODO_PAGO_LABEL, type MetodoPagoFarmacia } from "@/lib/farmacia/pos-constants"

export interface FilaVenta {
  id:      string
  numero:  number
  total:   number
  estado:  "completada" | "anulada"
  creada:  string
  cliente: string | null
  motivo_anulacion: string | null
  items:   string[]
  pagos:   { metodo: string; monto: number }[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtHora = (ts: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts))

export function VentasFarmacia({ ventas, esGestor }: { ventas: FilaVenta[]; esGestor: boolean }) {
  const router = useRouter()
  const [anulando, setAnulando] = useState<FilaVenta | null>(null)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const hoy = new Date().toDateString()
  const ventasHoy = ventas.filter(v => v.estado === "completada" && new Date(v.creada).toDateString() === hoy)
  const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0)
  const total7 = ventas.filter(v => v.estado === "completada").reduce((s, v) => s + v.total, 0)

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

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hoy</p>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{fmt(totalHoy)}</p>
          <p className="text-xs text-slate-400">{ventasHoy.length} ventas</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">7 días</p>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{fmt(total7)}</p>
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {ventas.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl">🧾</p>
            <p className="mt-2 text-sm font-medium text-slate-700">Sin ventas en los últimos 7 días</p>
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
                  {esGestor && <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ventas.map(v => (
                  <tr key={v.id} className={v.estado === "anulada" ? "bg-slate-50 opacity-60" : "hover:bg-slate-50/50"}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">#{v.numero}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtHora(v.creada)}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-700">{v.items.join(", ")}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{v.cliente ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {v.pagos.map((p, i) => (
                          <span key={i} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {METODO_PAGO_LABEL[p.metodo as MetodoPagoFarmacia] ?? p.metodo} {fmt(p.monto)}
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
                      {fmt(v.total)}
                    </td>
                    {esGestor && (
                      <td className="px-4 py-3 text-right">
                        {v.estado === "completada" && (
                          <button
                            onClick={() => { setError(null); setMotivo(""); setAnulando(v) }}
                            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            title="Anular venta"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
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

      {/* Dialog anulación */}
      <Dialog open={anulando !== null} onOpenChange={v => { if (!v) setAnulando(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Anular venta #{anulando?.numero}</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              {anulando?.items.join(", ")} · <strong>{anulando ? fmt(anulando.total) : ""}</strong>
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
