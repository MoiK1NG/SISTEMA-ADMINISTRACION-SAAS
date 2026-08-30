"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, ArrowRight, Ban, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  crearPedidoFarmacia, avanzarPedidoFarmacia, cancelarPedidoFarmacia,
} from "../../actions"
import { METODOS_PAGO_FARMACIA, METODO_PAGO_LABEL } from "@/lib/farmacia/pos-constants"

export interface ClientePedido { id: string; nombre: string; cedula: string | null; telefono: string | null }

export interface FilaPedido {
  id:          string
  descripcion: string
  cantidad:    number
  total:       number
  pagado:      number
  metodo:      string | null
  estado:      string
  notas:       string | null
  creada:      string
  cliente:     string
  telefono:    string | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtFecha = (ts: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(new Date(ts))

const ESTADOS: Record<string, { label: string; clases: string; siguiente: string | null }> = {
  pagado:     { label: "Pagado",     clases: "bg-blue-50 text-blue-700 border-blue-200",          siguiente: "Marcar pedido al proveedor" },
  pedido:     { label: "Pedido",     clases: "bg-amber-50 text-amber-700 border-amber-200",       siguiente: "Marcar recibido" },
  recibido:   { label: "Recibido",   clases: "bg-violet-50 text-violet-700 border-violet-200",    siguiente: "Marcar avisado" },
  notificado: { label: "Avisado",    clases: "bg-teal-50 text-teal-700 border-teal-200",          siguiente: "Marcar entregado" },
  entregado:  { label: "Entregado",  clases: "bg-emerald-50 text-emerald-700 border-emerald-200", siguiente: null },
  cancelado:  { label: "Cancelado",  clases: "bg-slate-100 text-slate-500 border-slate-200",      siguiente: null },
}

const FORM_VACIO = {
  cliente_id: "", descripcion: "", cantidad: 1, total: 0, monto_pagado: 0, metodo_pago: "", notas: "",
}

interface Props {
  pedidos:       FilaPedido[]
  clientes:      ClientePedido[]
  esGestor:      boolean
  soloLectura:   boolean
  nombreNegocio: string
}

export function PedidosFarmacia({ pedidos, clientes, esGestor, soloLectura, nombreNegocio }: Props) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<"abiertos" | "todos">("abiertos")
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [cancelando, setCancelando] = useState<FilaPedido | null>(null)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const visibles = useMemo(() =>
    filtro === "abiertos"
      ? pedidos.filter(p => !["entregado", "cancelado"].includes(p.estado))
      : pedidos,
    [pedidos, filtro])

  const abiertos = pedidos.filter(p => !["entregado", "cancelado"].includes(p.estado)).length

  function correr(fn: () => Promise<unknown>, despues?: () => void) {
    setError(null)
    start(async () => {
      try { await fn(); despues?.(); router.refresh() }
      catch (e: any) { setError(e?.message ?? "No se pudo completar") }
    })
  }

  function crear() {
    correr(
      () => crearPedidoFarmacia({
        ...form,
        metodo_pago: form.metodo_pago || null,
        producto_id: null,
      }),
      () => { setNuevoAbierto(false); setForm(FORM_VACIO) },
    )
  }

  function linkWhatsApp(p: FilaPedido) {
    const tel = (p.telefono ?? "").replace(/\D/g, "")
    const texto = encodeURIComponent(
      `Hola ${p.cliente}! Te escribimos de ${nombreNegocio}: tu encargo de ${p.descripcion} ya llegó y está listo para que lo recojas. ¡Te esperamos!`
    )
    // 57 = Colombia; si ya viene con indicativo no se duplica
    const numero = tel.startsWith("57") ? tel : `57${tel}`
    return `https://wa.me/${numero}?text=${texto}`
  }

  return (
    <div className="space-y-4">
      {error && !nuevoAbierto && !cancelando && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(["abiertos", "todos"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      filtro === f ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}>
              {f === "abiertos" ? `Abiertos (${abiertos})` : "Todos"}
            </button>
          ))}
        </div>
        {!soloLectura && (
          <Button size="sm" onClick={() => { setError(null); setNuevoAbierto(true) }}
                  className="gap-1.5 bg-teal-600 hover:bg-teal-700">
            <Plus className="h-3.5 w-3.5" />Nuevo encargo
          </Button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-3xl">📦</p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {filtro === "abiertos" ? "No hay encargos abiertos" : "Sin encargos registrados"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
            Cuando un cliente pague un producto que no hay en stock, regístralo acá para
            hacerle seguimiento y avisarle cuando llegue.
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isPending ? "opacity-60" : ""}`}>
          {visibles.map(p => {
            const est = ESTADOS[p.estado] ?? ESTADOS.pagado
            const saldo = p.total - p.pagado
            return (
              <div key={p.id} className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{p.descripcion}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {p.cantidad > 1 ? `${p.cantidad} unidades · ` : ""}{p.cliente} · {fmtFecha(p.creada)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${est.clases}`}>
                    {est.label}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total</span>
                    <span className="font-bold tabular-nums text-slate-900">{fmt(p.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Pagado{p.metodo ? ` (${METODO_PAGO_LABEL[p.metodo as keyof typeof METODO_PAGO_LABEL] ?? p.metodo})` : ""}
                    </span>
                    <span className="tabular-nums text-emerald-600">{fmt(p.pagado)}</span>
                  </div>
                  {saldo > 0 && (
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-400">Debe al retirar</span>
                      <span className="tabular-nums text-rose-600">{fmt(saldo)}</span>
                    </div>
                  )}
                  {p.notas && <p className="pt-1 text-[11px] italic text-slate-400">{p.notas}</p>}
                </div>

                {!soloLectura && (
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-50 pt-3">
                    {est.siguiente && (
                      <Button size="sm" variant="outline"
                              className="h-8 flex-1 gap-1 text-xs"
                              disabled={isPending}
                              onClick={() => correr(() => avanzarPedidoFarmacia(p.id))}>
                        {est.siguiente}<ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                    {p.estado === "recibido" && p.telefono && (
                      <a href={linkWhatsApp(p)} target="_blank" rel="noopener noreferrer"
                         className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 text-xs font-bold text-white hover:bg-emerald-600"
                         title="Avisar por WhatsApp">
                        <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                      </a>
                    )}
                    {esGestor && est.siguiente && (
                      <button onClick={() => { setError(null); setMotivo(""); setCancelando(p) }}
                              className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                              title="Cancelar encargo">
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Flujo: Pagado → Pedido al proveedor → Recibido → Avisado → Entregado. El botón de
        WhatsApp aparece al marcar &quot;Recibido&quot; y abre el chat con el mensaje listo.
      </p>

      {/* ── Dialog nuevo encargo ─────────────────────────────────────────────── */}
      <Dialog open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Nuevo encargo</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

            <div className="space-y-1.5">
              <Label>Cliente * (necesita teléfono para avisarle)</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.cliente_id}
                onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
              >
                <option value="">— Selecciona un cliente —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.telefono ? ` · ${c.telefono}` : " · SIN TELÉFONO"}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                ¿No está? Créalo desde la Caja (selector de cliente) y vuelve acá.
              </p>
            </div>

            <div className="grid grid-cols-[1fr_90px] gap-3">
              <div className="space-y-1.5">
                <Label>¿Qué se encargó? *</Label>
                <Input placeholder="Ej: Insulina glargina 100 UI" value={form.descripcion}
                       onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cantidad</Label>
                <Input type="number" min="1" value={form.cantidad || ""}
                       onChange={e => setForm(f => ({ ...f, cantidad: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total del encargo *</Label>
                <Input type="number" min="0" step="50" value={form.total || ""}
                       onChange={e => setForm(f => ({ ...f, total: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Pagó por adelantado</Label>
                <Input type="number" min="0" step="50" value={form.monto_pagado || ""}
                       onChange={e => setForm(f => ({ ...f, monto_pagado: Number(e.target.value) }))} />
              </div>
            </div>

            {form.monto_pagado > 0 && (
              <div className="space-y-1.5">
                <Label>Método del pago *</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.metodo_pago}
                  onChange={e => setForm(f => ({ ...f, metodo_pago: e.target.value }))}
                >
                  <option value="">— Método —</option>
                  {METODOS_PAGO_FARMACIA.map(m => (
                    <option key={m} value={m}>{METODO_PAGO_LABEL[m]}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input placeholder="Proveedor, referencia, etc." value={form.notas}
                     onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setNuevoAbierto(false)}>Cancelar</Button>
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={crear}
                      disabled={isPending || !form.cliente_id || !form.descripcion.trim() || form.total <= 0
                                || (form.monto_pagado > 0 && !form.metodo_pago)}>
                {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando…</> : "Registrar encargo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog cancelar ──────────────────────────────────────────────────── */}
      <Dialog open={cancelando !== null} onOpenChange={v => { if (!v) setCancelando(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Cancelar encargo</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              {cancelando?.descripcion} · {cancelando?.cliente}
              {cancelando && cancelando.pagado > 0 && (
                <span className="mt-1 block font-semibold text-amber-700">
                  ⚠ El cliente pagó {fmt(cancelando.pagado)} — recuerda devolvérselo.
                </span>
              )}
            </p>
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Input autoFocus value={motivo} onChange={e => setMotivo(e.target.value)}
                     placeholder="Ej: el proveedor no lo consigue" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setCancelando(null)}>Volver</Button>
              <Button variant="destructive" className="flex-1" disabled={isPending || !motivo.trim()}
                      onClick={() => cancelando && correr(() => cancelarPedidoFarmacia(cancelando.id, motivo), () => setCancelando(null))}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancelar encargo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
