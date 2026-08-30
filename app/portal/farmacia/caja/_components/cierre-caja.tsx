"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cerrarCajaFarmacia } from "../../actions"
import { METODOS_PAGO_FARMACIA, METODO_PAGO_LABEL, type MetodoPagoFarmacia } from "@/lib/farmacia/pos-constants"

export interface FilaCierre {
  id:         string
  cajero:     string
  desde:      string
  hasta:      string
  declarado:  Record<string, number>
  esperado:   Record<string, number>
  diferencia: Record<string, number>
  ventas:     number
  notas:      string | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtFechaHora = (ts: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts))

type Resultado = Awaited<ReturnType<typeof cerrarCajaFarmacia>>

export function CierreCaja({ cierres, esGestor, soloLectura }: {
  cierres:     FilaCierre[]
  esGestor:    boolean
  soloLectura: boolean
}) {
  const router = useRouter()
  const [montos, setMontos] = useState<Record<MetodoPagoFarmacia, string>>({
    efectivo: "", tarjeta_debito: "", tarjeta_credito: "", transferencia: "",
  })
  const [notas, setNotas] = useState("")
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function cerrar() {
    setError(null)
    start(async () => {
      try {
        const r = await cerrarCajaFarmacia({
          efectivo:        Number(montos.efectivo) || 0,
          tarjeta_debito:  Number(montos.tarjeta_debito) || 0,
          tarjeta_credito: Number(montos.tarjeta_credito) || 0,
          transferencia:   Number(montos.transferencia) || 0,
        }, notas || undefined)
        setResultado(r)
        setMontos({ efectivo: "", tarjeta_debito: "", tarjeta_credito: "", transferencia: "" })
        setNotas("")
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo cerrar la caja") }
    })
  }

  const difTotal = (c: { diferencia: Record<string, number> }) => Number(c.diferencia?.total ?? 0)

  return (
    <div className="space-y-6">

      {/* ── Formulario de cierre ciego ─────────────────────────────────────── */}
      {!soloLectura && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50">
              <Lock className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Cerrar caja (a ciegas)</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Cuenta lo que hay físicamente y declara los totales de los comprobantes.
                El sistema calcula lo esperado <strong>después</strong> de que declares —
                no antes — y guarda la diferencia. Cubre todo lo vendido desde el cierre anterior.
              </p>
            </div>
          </div>

          {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            {METODOS_PAGO_FARMACIA.map(m => (
              <div key={m} className="space-y-1.5">
                <Label>{m === "efectivo" ? "Efectivo contado" : `Total en ${METODO_PAGO_LABEL[m]}`}</Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={montos[m]}
                  onChange={e => setMontos(prev => ({ ...prev, [m]: e.target.value }))}
                  className="text-right tabular-nums"
                />
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Input placeholder="Novedades del turno…" value={notas} onChange={e => setNotas(e.target.value)} />
          </div>

          <Button
            className="mt-4 h-11 w-full rounded-xl bg-teal-600 font-bold hover:bg-teal-700"
            onClick={cerrar} disabled={isPending}
          >
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cerrando…</> : "🔒 Cerrar caja"}
          </Button>
        </div>
      )}

      {/* ── Resultado del cierre recién hecho ─────────────────────────────── */}
      {resultado && (
        <div className={`rounded-2xl border p-5 ${
          Math.abs(Number(resultado.diferencia.total)) < 0.01
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-300 bg-amber-50"
        }`}>
          <div className="mb-3 flex items-center gap-2">
            {Math.abs(Number(resultado.diferencia.total)) < 0.01
              ? <><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="text-sm font-bold text-emerald-900">Caja cuadrada — {resultado.num_ventas} ventas en el período</p></>
              : <><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="text-sm font-bold text-amber-900">Diferencia de {fmt(Number(resultado.diferencia.total))} — {resultado.num_ventas} ventas</p></>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-1 pr-4">Método</th><th className="py-1 pr-4 text-right">Declarado</th>
                  <th className="py-1 pr-4 text-right">Esperado</th><th className="py-1 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {METODOS_PAGO_FARMACIA.map(m => {
                  const d = Number(resultado.diferencia[m] ?? 0)
                  return (
                    <tr key={m} className="border-t border-black/5">
                      <td className="py-1.5 pr-4 font-medium text-slate-700">{METODO_PAGO_LABEL[m]}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{fmt(Number(resultado.declarado[m] ?? 0))}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{fmt(Number(resultado.esperado[m] ?? 0))}</td>
                      <td className={`py-1.5 text-right font-bold tabular-nums ${d === 0 ? "text-slate-400" : d > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {d > 0 ? "+" : ""}{fmt(d)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Historial ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 px-5 py-4">
          <p className="text-sm font-bold text-slate-900">Cierres anteriores</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {esGestor ? "Todos los cierres del negocio" : "Tus cierres"} · un cierre no se edita: si hubo un error, se documenta en el siguiente
          </p>
        </div>
        {cierres.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Todavía no hay cierres</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha</th>
                  {esGestor && <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Cerró</th>}
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Ventas</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Declarado</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Esperado</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cierres.map(c => {
                  const dec = METODOS_PAGO_FARMACIA.reduce((s, m) => s + Number(c.declarado?.[m] ?? 0), 0)
                  const esp = METODOS_PAGO_FARMACIA.reduce((s, m) => s + Number(c.esperado?.[m] ?? 0), 0)
                  const dif = difTotal(c)
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtFechaHora(c.hasta)}</td>
                      {esGestor && <td className="px-4 py-3 text-xs font-medium text-slate-700">{c.cajero}</td>}
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-500">{c.ventas}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmt(dec)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmt(esp)}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${
                        Math.abs(dif) < 0.01 ? "text-emerald-600" : dif > 0 ? "text-amber-600" : "text-rose-600"
                      }`}>
                        {Math.abs(dif) < 0.01 ? "✓ Cuadró" : `${dif > 0 ? "+" : ""}${fmt(dif)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
