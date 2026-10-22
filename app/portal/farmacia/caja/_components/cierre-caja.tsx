"use client"

import { useFormato } from "@/components/farmacia/negocio-provider"
import { Fragment, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, CheckCircle2, AlertTriangle, ChevronDown, LogOut, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { salirDeLaCuenta } from "@/components/boton-cerrar-sesion"
import { cerrarCajaFarmacia } from "../../actions"
import {
  CATEGORIA_GASTO_LABEL, METODOS_PAGO_FARMACIA, METODO_PAGO_LABEL, type MetodoPagoFarmacia,
} from "@/lib/farmacia/pos-constants"
import { AnularMovimientoDialog, BotonesSalidaCaja, type MovimientoCaja } from "./salidas-caja"

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
  retiros:    number
  gastos:     number
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

type Resultado = Awaited<ReturnType<typeof cerrarCajaFarmacia>>

type FilaTurno = { kind: "op"; hora: string; v: VentaTurno } | { kind: "mov"; hora: string; m: MovimientoCaja }

export function CierreCaja({ cierres, ventasTurno, movimientosCaja, esGestor, soloLectura }: {
  cierres:         FilaCierre[]
  ventasTurno:     VentaTurno[]
  movimientosCaja: MovimientoCaja[]
  esGestor:        boolean
  soloLectura:     boolean
}) {
  const f = useFormato()
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
  // Retiros y gastos registrados o anulados en esta pantalla, hasta que el
  // servidor vuelva a mandar la lista (al cerrar la caja)
  const [movsNuevos, setMovsNuevos] = useState<MovimientoCaja[]>([])
  const [anuladosAca, setAnuladosAca] = useState<Map<string, string>>(new Map())
  const [anulando, setAnulando] = useState<MovimientoCaja | null>(null)

  const movimientos = [...movsNuevos, ...movimientosCaja.filter(m => !movsNuevos.some(n => n.id === m.id))]
    .map(m => anuladosAca.has(m.id) ? { ...m, anulado: true, motivo: anuladosAca.get(m.id) ?? null } : m)
  const vigentes = movimientos.filter(m => !m.anulado)
  const totalRetiros = vigentes.filter(m => m.tipo === "retiro").reduce((s, m) => s + m.monto, 0)
  const totalGastos  = vigentes.filter(m => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0)

  const filasTurno: FilaTurno[] = [
    ...ventasTurno.map(v => ({ kind: "op" as const, hora: v.hora, v })),
    ...movimientos.map(m => ({ kind: "mov" as const, hora: m.hora, m })),
  ].sort((a, b) => b.hora.localeCompare(a.hora))

  // Cajero: al cerrar caja se cierra la sesión (pedido del cliente).
  // 30 segundos para leer el cuadre, o "Salir ahora".
  useEffect(() => {
    if (segundosSalida === null) return
    if (segundosSalida <= 0) { salir(); return }
    const t = setTimeout(() => setSegundosSalida(s => (s ?? 1) - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundosSalida])

  // Mismo cierre que el botón "Cerrar sesión" de la barra del portal
  const salir = salirDeLaCuenta

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
        setMovsNuevos([]); setAnuladosAca(new Map())
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
            {movimientos.length > 0 && ` · ${movimientos.length} ${movimientos.length === 1 ? "retiro o gasto" : "retiros y gastos"}`}
            {!esGestor && " · los totales por método se revelan al cerrar"}
          </p>
        </div>

        {esGestor && (totalesTurno.size > 0 || totalRetiros + totalGastos > 0) && (
          <div className="flex flex-wrap gap-2 border-b border-slate-50 px-5 py-3">
            {METODOS_PAGO_FARMACIA.filter(m => totalesTurno.has(m)).map(m => (
              <span key={m} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">
                {METODO_PAGO_LABEL[m]}: {f.dinero(totalesTurno.get(m) ?? 0)}
              </span>
            ))}
            {totalRetiros > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                Retiros: −{f.dinero(totalRetiros)}
              </span>
            )}
            {totalGastos > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                Gastos: −{f.dinero(totalGastos)}
              </span>
            )}
          </div>
        )}

        {filasTurno.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin movimientos en este turno</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                {filasTurno.map(fila => fila.kind === "mov" ? (
                  <tr key={`mov-${fila.m.id}`} className={`hover:bg-slate-50/50 ${fila.m.anulado ? "opacity-50" : ""}`}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-400">{f.hora(fila.m.hora)}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {fila.m.tipo === "retiro" ? "Retiro" : "Gasto"}
                      </span>
                    </td>
                    <td className="max-w-[16rem] px-3 py-2.5 text-xs text-slate-600">
                      <p className={`truncate ${fila.m.anulado ? "line-through" : ""}`}>{fila.m.concepto}</p>
                      <p className="truncate text-[10px] text-slate-400">
                        {fila.m.categoria ? `${CATEGORIA_GASTO_LABEL[fila.m.categoria]} · ` : ""}{fila.m.autor}
                        {fila.m.anulado && ` · anulado${fila.m.motivo ? `: ${fila.m.motivo}` : ""}`}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {!soloLectura && !fila.m.anulado && (fila.m.propio || esGestor) && (
                        <button onClick={() => setAnulando(fila.m)} title="Anular"
                                className="rounded-md p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                    <td className={`px-5 py-2.5 text-right text-xs font-bold tabular-nums ${fila.m.anulado ? "text-slate-400 line-through" : "text-amber-700"}`}>
                      −{f.dinero(fila.m.monto)}
                    </td>
                  </tr>
                ) : (() => { const v = fila.v; return (
                  <tr key={`${v.tipo}-${v.id}`} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-400">{f.hora(v.hora)}</td>
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
                            {METODO_PAGO_LABEL[p.metodo as MetodoPagoFarmacia] ?? p.metodo} {f.dinero(p.monto)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">{f.dinero(v.total)}</td>
                  </tr>
                ) })())}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Retiros y gastos: efectivo que sale del cajón sin ser venta ────── */}
      {!soloLectura && segundosSalida === null && (
        <div className="space-y-2">
          <BotonesSalidaCaja onRegistrado={m => setMovsNuevos(prev => [m, ...prev])} />
          <p className="text-center text-[11px] text-slate-400">
            Registra aquí la plata que sacas de la caja durante el turno: el cierre la descuenta del efectivo.
          </p>
        </div>
      )}
      <AnularMovimientoDialog
        movimiento={anulando}
        onCerrar={() => setAnulando(null)}
        onAnulado={(id, motivo) => { setAnuladosAca(prev => new Map(prev).set(id, motivo)); setAnulando(null) }}
      />

      {/* ── Formulario de cierre ciego ─────────────────────────────────────── */}
      {!soloLectura && segundosSalida === null && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
              <Lock className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Cerrar caja (a ciegas)</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Cuenta lo que hay físicamente y declara los totales de los comprobantes.
                El sistema calcula lo esperado <strong>después</strong> de que declares —
                no antes — y guarda la diferencia. Cubre todo lo vendido desde el cierre anterior
                y descuenta los retiros y gastos registrados en el turno.
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
            className="mt-4 h-11 w-full rounded-xl bg-brand-600 font-bold hover:bg-brand-700"
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
              : <><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="text-sm font-bold text-amber-900">Diferencia de {f.dinero(Number(resultado.diferencia.total))} — {resultado.num_ventas} ventas</p></>}
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
                      <td className="py-1.5 pr-4 text-right tabular-nums">{f.dinero(Number(resultado.declarado[m] ?? 0))}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{f.dinero(Number(resultado.esperado[m] ?? 0))}</td>
                      <td className={`py-1.5 text-right font-bold tabular-nums ${d === 0 ? "text-slate-400" : d > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {d > 0 ? "+" : ""}{f.dinero(d)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(Number(resultado.retiros) > 0 || Number(resultado.gastos) > 0) && (
            <p className="mt-2 text-[11px] text-slate-500">
              El efectivo esperado ya descuenta
              {Number(resultado.retiros) > 0 && <> retiros por <strong>{f.dinero(Number(resultado.retiros))}</strong></>}
              {Number(resultado.retiros) > 0 && Number(resultado.gastos) > 0 && " y"}
              {Number(resultado.gastos) > 0 && <> gastos por <strong>{f.dinero(Number(resultado.gastos))}</strong></>}.
            </p>
          )}

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
                    <Fragment key={c.id}>
                      <tr onClick={() => setExpandido(abierto ? null : c.id)}
                          className="cursor-pointer hover:bg-slate-50/50">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{f.fechaHora(c.hasta)}</td>
                        {esGestor && <td className="px-4 py-3 text-xs font-medium text-slate-700">{c.cajero}</td>}
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-500">{c.ventas}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{f.dinero(dec)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{f.dinero(esp)}</td>
                        <td className={`px-4 py-3 text-right font-bold tabular-nums ${
                          Math.abs(dif) < 0.01 ? "text-emerald-600" : dif > 0 ? "text-amber-600" : "text-rose-600"
                        }`}>
                          {Math.abs(dif) < 0.01 ? "✓ Cuadró" : `${dif > 0 ? "+" : ""}${f.dinero(dif)}`}
                        </td>
                        <td className="pr-3 text-right">
                          <ChevronDown className={`h-4 w-4 text-slate-300 transition-transform ${abierto ? "rotate-180" : ""}`} />
                        </td>
                      </tr>
                      {abierto && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={esGestor ? 7 : 6} className="px-6 py-3">
                            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                              {METODOS_PAGO_FARMACIA.map(m => {
                                const d = Number(c.diferencia?.[m] ?? 0)
                                return (
                                  <div key={m} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">{METODO_PAGO_LABEL[m]}</span>
                                    <span className="tabular-nums">
                                      {f.dinero(Number(c.declarado?.[m] ?? 0))} / {f.dinero(Number(c.esperado?.[m] ?? 0))}
                                      <span className={`ml-2 font-bold ${d === 0 ? "text-slate-300" : d > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {d > 0 ? "+" : ""}{d === 0 ? "—" : f.dinero(d)}
                                      </span>
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                            {(c.retiros > 0 || c.gastos > 0) && (
                              <p className="mt-2 text-xs text-slate-500">
                                Salió del cajón durante el turno:
                                {c.retiros > 0 && <> retiros <strong className="tabular-nums">{f.dinero(c.retiros)}</strong></>}
                                {c.retiros > 0 && c.gastos > 0 && " ·"}
                                {c.gastos > 0 && <> gastos <strong className="tabular-nums">{f.dinero(c.gastos)}</strong></>}
                                {" "}(ya descontado del efectivo esperado)
                              </p>
                            )}
                            <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">
                              declarado / esperado · diferencia{c.notas ? ` — nota: ${c.notas}` : ""}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
