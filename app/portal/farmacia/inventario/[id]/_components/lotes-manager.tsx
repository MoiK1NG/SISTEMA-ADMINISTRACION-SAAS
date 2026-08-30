"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, MoreHorizontal, PackagePlus, PackageMinus, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CADUCIDAD_META, type EstadoCaducidad, diasParaVencer } from "@/lib/farmacia/caducidad"
import { crearLoteFarmacia, registrarMovimientoFarmacia } from "../../../actions"

export interface FilaLote {
  id:                string
  lote:              string
  fecha_vencimiento: string
  cantidad_venta:    number
  cantidad_bodega:   number
  estanteria:        string | null
  semaforo:          EstadoCaducidad
}

const fmtFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso + "T00:00:00"))

const MOVIMIENTOS: { tipo: string; label: string; icon: any; pide: "venta" | "bodega" | "ambos" }[] = [
  { tipo: "traslado_a_venta",  label: "Pasar de bodega a venta", icon: ArrowLeftRight, pide: "bodega" },
  { tipo: "traslado_a_bodega", label: "Pasar de venta a bodega", icon: ArrowLeftRight, pide: "venta"  },
  { tipo: "entrada_venta",     label: "Entrada a venta",         icon: PackagePlus,    pide: "ambos"  },
  { tipo: "entrada_bodega",    label: "Entrada a bodega",        icon: PackagePlus,    pide: "ambos"  },
  { tipo: "merma_venta",       label: "Merma en venta",          icon: PackageMinus,   pide: "venta"  },
  { tipo: "merma_bodega",      label: "Merma en bodega",         icon: PackageMinus,   pide: "bodega" },
]

const LOTE_VACIO = { lote: "", fecha_vencimiento: "", cantidad_venta: 0, cantidad_bodega: 0, estanteria: "" }

export function LotesManager({ productoId, lotes, esGestor }: {
  productoId: string
  lotes:      FilaLote[]
  esGestor:   boolean
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [error, setError]  = useState<string | null>(null)

  // Dialog nuevo lote
  const [loteAbierto, setLoteAbierto] = useState(false)
  const [formLote, setFormLote]       = useState(LOTE_VACIO)

  // Dialog movimiento
  const [mov, setMov] = useState<{ lote: FilaLote; tipo: string; label: string } | null>(null)
  const [cantidad, setCantidad] = useState("")
  const [motivo, setMotivo]     = useState("")

  function crearLote() {
    setError(null)
    start(async () => {
      try {
        await crearLoteFarmacia({ producto_id: productoId, ...formLote })
        setLoteAbierto(false)
        setFormLote(LOTE_VACIO)
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo crear el lote") }
    })
  }

  function ejecutarMovimiento() {
    if (!mov) return
    setError(null)
    start(async () => {
      try {
        await registrarMovimientoFarmacia({
          lote_id: mov.lote.id,
          producto_id: productoId,
          tipo: mov.tipo,
          cantidad: Number(cantidad),
          motivo: motivo || undefined,
        })
        setMov(null); setCantidad(""); setMotivo("")
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo registrar el movimiento") }
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-50 px-5 py-4">
        <div>
          <p className="text-sm font-bold text-slate-900">Lotes</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Ordenados por FEFO: el primero de la lista es el que debe salir primero
          </p>
        </div>
        {esGestor && (
          <Button size="sm" onClick={() => { setError(null); setLoteAbierto(true) }}
                  className="gap-1.5 bg-teal-600 hover:bg-teal-700">
            <Plus className="h-3.5 w-3.5" />Ingresar lote
          </Button>
        )}
      </div>

      {error && !loteAbierto && !mov && (
        <p className="mx-5 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
      )}

      {lotes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl">📦</p>
          <p className="mt-2 text-sm font-medium text-slate-700">Sin lotes ingresados</p>
          <p className="mt-1 text-xs text-slate-400">
            {esGestor ? "Ingresa el primer lote con su fecha de vencimiento" : "El dueño o regente deben ingresar mercancía"}
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto transition-opacity ${isPending ? "opacity-60" : ""}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Lote</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Vencimiento</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Venta</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Bodega</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Estantería</th>
                {esGestor && <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Mover</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lotes.map((l, idx) => {
                const sem = CADUCIDAD_META[l.semaforo]
                const dias = diasParaVencer(l.fecha_vencimiento)
                return (
                  <tr key={l.id} className={`${l.semaforo === "vencido" ? "bg-slate-50" : ""} hover:bg-slate-50/50`}>
                    <td className="px-5 py-3">
                      <span className="font-mono text-sm font-semibold text-slate-900">{l.lote}</span>
                      {idx === 0 && l.semaforo !== "vencido" && (l.cantidad_venta + l.cantidad_bodega) > 0 && (
                        <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">sale primero</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sem.clases}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sem.dot}`} />
                        {fmtFecha(l.fecha_vencimiento)}
                      </span>
                      <span className="ml-2 text-[10px] text-slate-400">
                        {dias < 0 ? `venció hace ${-dias} días` : `en ${dias} días`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">{l.cantidad_venta}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-500">{l.cantidad_bodega}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{l.estanteria ?? "—"}</td>
                    {esGestor && (
                      <td className="px-5 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isPending}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="text-xs font-normal text-slate-400">
                              Movimiento sobre el lote {l.lote}
                            </DropdownMenuLabel>
                            {MOVIMIENTOS.map(m => (
                              <DropdownMenuItem
                                key={m.tipo}
                                className="cursor-pointer gap-2 text-sm"
                                onClick={() => { setError(null); setCantidad(""); setMotivo(""); setMov({ lote: l, tipo: m.tipo, label: m.label }) }}
                              >
                                <m.icon className="h-4 w-4 text-slate-400" />
                                {m.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Dialog: nuevo lote ─────────────────────────────────────────────── */}
      <Dialog open={loteAbierto} onOpenChange={setLoteAbierto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ingresar lote</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Número de lote *</Label>
                <Input autoFocus placeholder="L-2409A" value={formLote.lote}
                       onChange={e => setFormLote(f => ({ ...f, lote: e.target.value }))} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Vence *</Label>
                <Input type="date" value={formLote.fecha_vencimiento}
                       onChange={e => setFormLote(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unidades a venta</Label>
                <Input type="number" min="0" value={formLote.cantidad_venta || ""}
                       onChange={e => setFormLote(f => ({ ...f, cantidad_venta: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidades a bodega</Label>
                <Input type="number" min="0" value={formLote.cantidad_bodega || ""}
                       onChange={e => setFormLote(f => ({ ...f, cantidad_bodega: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Estantería (ubicación)</Label>
              <Input placeholder="Ej: A-3, Vitrina 2…" value={formLote.estanteria}
                     onChange={e => setFormLote(f => ({ ...f, estanteria: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setLoteAbierto(false)}>Cancelar</Button>
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={crearLote}
                      disabled={isPending || !formLote.lote.trim() || !formLote.fecha_vencimiento}>
                {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando…</> : "Ingresar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: movimiento ─────────────────────────────────────────────── */}
      <Dialog open={mov !== null} onOpenChange={v => { if (!v) setMov(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{mov?.label}</DialogTitle></DialogHeader>
          {mov && (
            <div className="mt-2 space-y-4">
              {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
              <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                Lote <span className="font-mono font-semibold text-slate-700">{mov.lote.lote}</span> ·
                venta <strong>{mov.lote.cantidad_venta}</strong> · bodega <strong>{mov.lote.cantidad_bodega}</strong>
              </div>
              <div className="space-y-1.5">
                <Label>Cantidad *</Label>
                <Input autoFocus type="number" min="1" value={cantidad}
                       onChange={e => setCantidad(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo {mov.tipo.startsWith("merma") ? "*" : "(opcional)"}</Label>
                <Input placeholder={mov.tipo.startsWith("merma") ? "Ej: producto vencido, envase roto…" : "Nota…"}
                       value={motivo} onChange={e => setMotivo(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setMov(null)}>Cancelar</Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  onClick={ejecutarMovimiento}
                  disabled={isPending || !(Number(cantidad) > 0) || (mov.tipo.startsWith("merma") && !motivo.trim())}
                >
                  {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Registrando…</> : "Registrar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
