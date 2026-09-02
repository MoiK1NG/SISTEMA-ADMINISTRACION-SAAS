"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, HandCoins, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  crearCuentaPagarFarmacia, abonarCuentaPagarFarmacia, anularCuentaPagarFarmacia,
  crearProveedorFarmacia,
} from "../../actions"
import { METODOS_PAGO_FARMACIA, METODO_PAGO_LABEL } from "@/lib/farmacia/pos-constants"

export interface FilaCuenta {
  id:        string
  concepto:  string
  proveedor: string | null
  total:     number
  pagado:    number
  vence:     string | null
  estado:    string
  notas:     string | null
  creada:    string
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso.includes("T") ? iso : iso + "T00:00:00"))

const ESTADO_META: Record<string, { label: string; clases: string }> = {
  pendiente: { label: "Pendiente", clases: "bg-amber-50 text-amber-700 border-amber-200"     },
  parcial:   { label: "Parcial",   clases: "bg-blue-50 text-blue-700 border-blue-200"         },
  pagada:    { label: "Pagada",    clases: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  anulada:   { label: "Anulada",   clases: "bg-slate-100 text-slate-500 border-slate-200"     },
}

const FORM_VACIO = { proveedor_id: "", concepto: "", monto_total: 0, fecha_vencimiento: "", notas: "" }

interface Props {
  cuentas:     FilaCuenta[]
  proveedores: { id: string; nombre: string }[]
  esDueno:     boolean
  soloLectura: boolean
}

export function ComprasFarmacia({ cuentas, proveedores, esDueno, soloLectura }: Props) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<"abiertas" | "todas">("abiertas")
  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [buscaProv, setBuscaProv] = useState("")
  const [provAbierto, setProvAbierto] = useState(false)
  const [abonando, setAbonando] = useState<FilaCuenta | null>(null)
  const [abono, setAbono] = useState("")
  const [metodoAbono, setMetodoAbono] = useState("")
  const [anulando, setAnulando] = useState<FilaCuenta | null>(null)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const visibles = useMemo(() =>
    filtro === "abiertas" ? cuentas.filter(c => ["pendiente", "parcial"].includes(c.estado)) : cuentas,
    [cuentas, filtro])

  const deudaTotal = cuentas
    .filter(c => ["pendiente", "parcial"].includes(c.estado))
    .reduce((s, c) => s + (c.total - c.pagado), 0)

  const hoy = new Date().toISOString().split("T")[0]
  const vencidas = cuentas.filter(c =>
    ["pendiente", "parcial"].includes(c.estado) && c.vence && c.vence < hoy
  ).length

  function correr(fn: () => Promise<unknown>, despues?: () => void) {
    setError(null)
    start(async () => {
      try { await fn(); despues?.(); router.refresh() }
      catch (e: any) { setError(e?.message ?? "No se pudo completar") }
    })
  }

  return (
    <div className="space-y-4">
      {error && !nuevaAbierta && !abonando && !anulando && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Deuda abierta</p>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{fmt(deudaTotal)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vencidas</p>
          <p className={`mt-1 text-xl font-black tabular-nums ${vencidas > 0 ? "text-rose-600" : "text-slate-900"}`}>{vencidas}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["abiertas", "todas"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      filtro === f ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}>
              {f === "abiertas" ? "Abiertas" : "Todas"}
            </button>
          ))}
        </div>
        {!soloLectura && (
          <Button size="sm" onClick={() => { setError(null); setNuevaAbierta(true) }}
                  className="gap-1.5 bg-teal-600 hover:bg-teal-700">
            <Plus className="h-3.5 w-3.5" />Nueva cuenta
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {visibles.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-3xl">🧾</p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              {filtro === "abiertas" ? "No debes nada a proveedores" : "Sin cuentas registradas"}
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isPending ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Concepto</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Vence</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Pagado</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Saldo</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibles.map(c => {
                  const est = ESTADO_META[c.estado] ?? ESTADO_META.pendiente
                  const saldo = c.total - c.pagado
                  const vencida = c.vence && c.vence < hoy && ["pendiente", "parcial"].includes(c.estado)
                  return (
                    <tr key={c.id} className={c.estado === "anulada" ? "opacity-50" : "hover:bg-slate-50/50"}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{c.concepto}</p>
                        <p className="text-xs text-slate-400">{c.proveedor ?? "Sin proveedor"} · {fmtFecha(c.creada)}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {c.vence
                          ? <span className={vencida ? "font-bold text-rose-600" : "text-slate-500"}>{fmtFecha(c.vence)}{vencida ? " ⚠" : ""}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${est.clases}`}>{est.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-emerald-600">{fmt(c.pagado)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                        {["pendiente", "parcial"].includes(c.estado) ? fmt(saldo) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!soloLectura && ["pendiente", "parcial"].includes(c.estado) && (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setError(null); setAbono(""); setMetodoAbono(""); setAbonando(c) }}
                                    className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100">
                              <HandCoins className="h-3.5 w-3.5" />Abonar
                            </button>
                            {esDueno && (
                              <button onClick={() => { setError(null); setMotivo(""); setAnulando(c) }}
                                      className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600" title="Anular">
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialog nueva cuenta ──────────────────────────────────────────────── */}
      <Dialog open={nuevaAbierta} onOpenChange={setNuevaAbierta}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nueva cuenta por pagar</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <div className="space-y-1.5">
              <Label>Concepto *</Label>
              <Input autoFocus placeholder="Ej: Factura #4521 — pedido mensual" value={form.concepto}
                     onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              {form.proveedor_id ? (
                <div className="flex items-center justify-between rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm">
                  <span className="font-medium text-teal-800">
                    {proveedores.find(p => p.id === form.proveedor_id)?.nombre ?? buscaProv}
                  </span>
                  <button type="button" className="text-xs text-teal-600 hover:underline"
                          onClick={() => { setForm(f => ({ ...f, proveedor_id: "" })); setBuscaProv("") }}>
                    cambiar
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Busca o escribe uno nuevo…"
                    value={buscaProv}
                    onChange={e => { setBuscaProv(e.target.value); setProvAbierto(true) }}
                    onFocus={() => setProvAbierto(true)}
                  />
                  {provAbierto && buscaProv.trim() !== "" && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {proveedores
                        .filter(p => p.nombre.toLowerCase().includes(buscaProv.toLowerCase()))
                        .slice(0, 6)
                        .map(p => (
                          <button key={p.id} type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                                  onClick={() => { setForm(f => ({ ...f, proveedor_id: p.id })); setProvAbierto(false) }}>
                            {p.nombre}
                          </button>
                        ))}
                      <button type="button"
                              className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-teal-700 hover:bg-teal-50"
                              disabled={isPending}
                              onClick={() => correr(
                                async () => {
                                  const nuevo = await crearProveedorFarmacia(buscaProv.trim())
                                  proveedores.push(nuevo as { id: string; nombre: string })
                                  setForm(f => ({ ...f, proveedor_id: (nuevo as any).id }))
                                },
                                () => setProvAbierto(false),
                              )}>
                        + Crear proveedor «{buscaProv.trim()}»
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto *</Label>
                <Input type="number" min="0" step="50" value={form.monto_total || ""}
                       onChange={e => setForm(f => ({ ...f, monto_total: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Vence</Label>
                <Input type="date" value={form.fecha_vencimiento}
                       onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setNuevaAbierta(false)}>Cancelar</Button>
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700"
                      disabled={isPending || !form.concepto.trim() || form.monto_total <= 0}
                      onClick={() => correr(
                        () => crearCuentaPagarFarmacia({
                          ...form,
                          proveedor_id: form.proveedor_id || null,
                          fecha_vencimiento: form.fecha_vencimiento || null,
                        }),
                        () => { setNuevaAbierta(false); setForm(FORM_VACIO) },
                      )}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Registrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog abonar ────────────────────────────────────────────────────── */}
      <Dialog open={abonando !== null} onOpenChange={v => { if (!v) setAbonando(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Abonar</DialogTitle></DialogHeader>
          {abonando && (
            <div className="mt-2 space-y-4">
              {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
              <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
                {abonando.concepto} · debe <strong>{fmt(abonando.total - abonando.pagado)}</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Monto *</Label>
                  <Input autoFocus type="number" min="0" value={abono} onChange={e => setAbono(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Método</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={metodoAbono} onChange={e => setMetodoAbono(e.target.value)}>
                    <option value="">—</option>
                    {METODOS_PAGO_FARMACIA.map(m => <option key={m} value={m}>{METODO_PAGO_LABEL[m]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setAbonando(null)}>Cancelar</Button>
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700"
                        disabled={isPending || !(Number(abono) > 0)}
                        onClick={() => correr(
                          () => abonarCuentaPagarFarmacia(abonando.id, Number(abono), metodoAbono || undefined),
                          () => setAbonando(null),
                        )}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Abonar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog anular ────────────────────────────────────────────────────── */}
      <Dialog open={anulando !== null} onOpenChange={v => { if (!v) setAnulando(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Anular cuenta</DialogTitle></DialogHeader>
          {anulando && (
            <div className="mt-2 space-y-4">
              {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
              <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">{anulando.concepto}</p>
              <div className="space-y-1.5">
                <Label>Motivo *</Label>
                <Input autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setAnulando(null)}>Volver</Button>
                <Button variant="destructive" className="flex-1" disabled={isPending || !motivo.trim()}
                        onClick={() => correr(() => anularCuentaPagarFarmacia(anulando.id, motivo), () => setAnulando(null))}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Anular"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
