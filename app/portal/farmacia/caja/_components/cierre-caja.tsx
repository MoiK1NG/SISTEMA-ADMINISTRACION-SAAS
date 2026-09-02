"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, CheckCircle2, AlertTriangle, ChevronDown, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
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

export interface VentaTurno {
  id:     string
  numero: number
  hora:   string
  total:  number
  items:  string
  pagos:  { metodo: string; monto: number }[]
  tipo:   "venta" | "encargo"
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtFechaHora = (ts: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts))

const fmtHora = (ts: string) =>
  new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts))

type Resultado = Awaited<ReturnType<typeof cerrarCajaFarmacia>>

export function CierreCaja({ cierres, ventasTurno, esGestor, soloLectura }: {
  cierres:     FilaCierre[]
  ventasTurno: VentaTurno[]
  esGestor:    boolean
  soloLectura: boolean
}) {
  const router = useRouter()
  const [montos, setMontos] = useState<Record<MetodoPagoFarmacia, string>>({
    efectivo: "", tarjeta_debito: "", tarjeta_credito: "", transferencia: "",
  })
  const [notas, setNotas] = useState("")
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()
  const [segundosSalida, setSegundosSalida] = useState<number | null>(null)

  // Cajero: al cerrar caja se cierra la sesión (pedido del cliente).
  // 30 segundos para leer el cuadre, o "Salir ahora".
  useEffect(() => {
    if (segundosSalida === null) return
    if (segundosSalida <= 0) { salir(); return }
    const t = setTimeout(() => setSegundosSalida(s => (s ?? 1) - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundosSalida])

  async function salir() {
    const supabase = createClient()
    if (supabase) await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

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
        if (!esGestor) setSegundosSalida(30)
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo cerrar la caja") }
    })
  }

  const difTotal = (c: { diferencia: Record<string, number> }) => Number(c.diferencia?.total ?? 0)

  // Totales del turno por método — SOLO gestores (el cajero declara a ciegas)
  const totalesTurno = new Map<string, number>()
  for (const v of ventasTurno) {
    for (const p of v.pagos) {
      totalesTurno.set(p.metodo, (totalesTurno.get(p.metodo) ?? 0) + p.monto)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Movimientos del turno (desde el último cierre) ─────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 px-5 py-4">
          <p className="text-sm font-bold text-slate-900">Movimientos del turno</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {ventasTurno.length} operaciones desde el último cierre
            {!esGestor && " · los totales por método se revelan al cerrar"}
          </p>
        </div>

        {esGestor && totalesTurno.size > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-50 px-5 py-3">
            {METODOS_PAGO_FARMACIA.filter(m => totalesTurno.has(m)).map(m => (
              <span key={m} className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
                {METODO_PAGO_LABEL[m]}: {fmt(totalesTurno.get(m) ?? 0)}
              </span>
            ))}
          </div>
        )}

        {ventasTurno.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin movimientos en este turno</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                {ventasTurno.map(v => (
                  <tr key={`${v.tipo}-${v.id}`} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-400">{fmtHora(v.hora)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        v.tipo === "encargo" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {v.tipo === "encargo" ? "Encargo" : `Venta #${v.numero}`}
                      </span>
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-2.5 text-xs text-slate-600">{v.items}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {v.pagos.map((p, i) => (
                          <span key={i} className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {METODO_PAGO_LABEL[p.metodo as MetodoPagoFarmacia] ?? p.metodo} {fmt(p.monto)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">{fmt(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Formulario de cierre ciego ─────────────────────────────────────── */}
      {!soloLectura && segundosSalida === null && (
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
          {!esGestor && (
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Al cerrar la caja se cierra también tu sesión.
            </p>
          )}
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

          {segundosSalida !== null && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">
                Tu sesión se cerrará en <strong className="tabular-nums">{segundosSalida}s</strong>
              </p>
              <Button size="sm" onClick={salir} className="gap-1.5 bg-slate-800 hover:bg-slate-900">
                <LogOut className="h-3.5 w-3.5" />Salir ahora
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Historial ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 px-5 py-4">
          <p className="text-sm font-bold text-slate-900">Cierres anteriores</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {esGestor ? "Todos los cierres del negocio" : "Tus cierres"} · toca una fila para ver el
            desglose por método · un cierre no se edita: si hubo un error, se documenta en el siguiente
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
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cierres.map(c => {
                  const dec = METODOS_PAGO_FARMACIA.reduce((s, m) => s + Number(c.declarado?.[m] ?? 0), 0)
                  const esp = METODOS_PAGO_FARMACIA.reduce((s, m) => s + Number(c.esperado?.[m] ?? 0), 0)
                  const dif = difTotal(c)
                  const abierto = expandido === c.id
                  return (
                    <>
                      <tr key={c.id} onClick={() => setExpandido(abierto ? null : c.id)}
                          className="cursor-pointer hover:bg-slate-50/50">
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
                        <td className="pr-3 text-right">
                          <ChevronDown className={`h-4 w-4 text-slate-300 transition-transform ${abierto ? "rotate-180" : ""}`} />
                        </td>
                      </tr>
                      {abierto && (
                        <tr key={`${c.id}-det`} className="bg-slate-50/60">
                          <td colSpan={esGestor ? 7 : 6} className="px-6 py-3">
                            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                              {METODOS_PAGO_FARMACIA.map(m => {
                                const d = Number(c.diferencia?.[m] ?? 0)
                                return (
                                  <div key={m} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">{METODO_PAGO_LABEL[m]}</span>
                                    <span className="tabular-nums">
                                      {fmt(Number(c.declarado?.[m] ?? 0))} / {fmt(Number(c.esperado?.[m] ?? 0))}
                                      <span className={`ml-2 font-bold ${d === 0 ? "text-slate-300" : d > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {d > 0 ? "+" : ""}{d === 0 ? "—" : fmt(d)}
                                      </span>
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                            <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">
                              declarado / esperado · diferencia{c.notas ? ` — nota: ${c.notas}` : ""}
                            </p>
                          </td>
                        </tr>
                      )}
                    </>
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
