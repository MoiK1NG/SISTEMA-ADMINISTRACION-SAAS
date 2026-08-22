"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, ArrowUp, ArrowDown, SlidersHorizontal, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { crearInsumo, registrarMovimientoInsumo } from "../../actions"

interface Insumo {
  id: string; nombre: string; unidad: string
  stock_actual: number; stock_minimo: number; precio_unidad: number
}

const UNIDADES = ["kg", "libra", "g", "litro", "ml", "unidad", "bolsa", "caja", "galón"]
const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

function NuevoInsumoButton({ isPending, onCreate }: { isPending: boolean; onCreate: (d: any) => void }) {
  const [open, setOpen]  = useState(false)
  const [nombre, setNombre] = useState("")
  const [unidad, setUnidad] = useState("kg")
  const [stockInicial, setStockInicial] = useState("0")
  const [stockMin, setStockMin]         = useState("0")
  const [precio, setPrecio]             = useState("0")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />Nuevo insumo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Nuevo insumo</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Harina de trigo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stock inicial</Label>
              <Input type="number" min="0" step="0.01" value={stockInicial} onChange={e => setStockInicial(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Stock mínimo</Label>
              <Input type="number" min="0" step="0.01" value={stockMin} onChange={e => setStockMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Precio / unidad</Label>
              <Input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={isPending || !nombre}
              onClick={() => {
                onCreate({ nombre, unidad, stock_actual: Number(stockInicial), stock_minimo: Number(stockMin), precio_unidad: Number(precio) })
                setOpen(false)
              }}>
              {isPending ? "Guardando…" : "Crear"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MovimientoButton({ insumo, isPending, onMove }: { insumo: Insumo; isPending: boolean; onMove: (id: string, tipo: any, cantidad: number, nota: string) => void }) {
  const [open, setOpen]   = useState(false)
  const [tipo, setTipo]   = useState<"entrada" | "salida">("entrada")
  const [cantidad, setCantidad] = useState("")
  const [nota, setNota]   = useState("")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-[11px] font-medium text-orange-500 border border-orange-200 rounded px-2 py-1 hover:bg-orange-50">
          <SlidersHorizontal className="h-3 w-3 inline mr-1" />Movimiento
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader><DialogTitle>{insumo.nombre}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-2">
            {(["entrada","salida"] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${tipo === t ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600"}`}>
                {t === "entrada" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad ({insumo.unidad})</Label>
            <Input type="number" min="0.01" step="0.01" value={cantidad} onChange={e => setCantidad(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nota (opcional)</Label>
            <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Razón del movimiento…" />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={isPending || !cantidad}
              onClick={() => { onMove(insumo.id, tipo, Number(cantidad), nota); setOpen(false) }}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function InventarioManager({ insumos }: { insumos: Insumo[] }) {
  const router = useRouter()
  const [isPending, start] = useTransition()

  function handleCreate(data: any) {
    start(async () => { await crearInsumo(data); router.refresh() })
  }
  function handleMove(id: string, tipo: any, cantidad: number, nota: string) {
    start(async () => { await registrarMovimientoInsumo(id, tipo, cantidad, nota || undefined); router.refresh() })
  }

  const alertas = insumos.filter(i => i.stock_actual <= i.stock_minimo)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <NuevoInsumoButton isPending={isPending} onCreate={handleCreate} />
      </div>

      {alertas.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-semibold">{alertas.length} insumo{alertas.length !== 1 ? "s" : ""} con stock bajo</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertas.map(i => (
              <span key={i.id} className="rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                {i.nombre}: {i.stock_actual} {i.unidad}
              </span>
            ))}
          </div>
        </div>
      )}

      {insumos.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <SlidersHorizontal className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-lg font-semibold text-slate-700">Sin insumos</p>
          <p className="text-sm text-slate-400">Agrega los insumos que usas en tu panadería</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insumos.map(i => {
            const bajo = i.stock_actual <= i.stock_minimo
            return (
              <div key={i.id} className={`rounded-xl border bg-white p-4 shadow-sm ${bajo ? "border-rose-200" : "border-slate-100"}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{i.nombre}</p>
                    <p className="text-[11px] text-slate-400">{fmt(i.precio_unidad)} / {i.unidad}</p>
                  </div>
                  {bajo && <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Stock actual</span>
                    <span className={`font-semibold ${bajo ? "text-rose-600" : "text-slate-900"}`}>{i.stock_actual} {i.unidad}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${bajo ? "bg-rose-400" : "bg-emerald-400"}`}
                      style={{ width: `${Math.min(100, i.stock_minimo > 0 ? (i.stock_actual / (i.stock_minimo * 3)) * 100 : 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Mínimo: {i.stock_minimo} {i.unidad}</span>
                    <MovimientoButton insumo={i} isPending={isPending} onMove={handleMove} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
