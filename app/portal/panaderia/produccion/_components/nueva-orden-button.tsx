"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { crearOrdenProduccion } from "../../actions"

interface Producto { id: string; nombre: string; categoria: string }
interface Props { productos: Producto[]; forToday?: boolean }

export function NuevaOrdenButton({ productos, forToday }: Props) {
  const router  = useRouter()
  const [open, setOpen]    = useState(false)
  const [isPending, start] = useTransition()
  const [error, setError]  = useState<string | null>(null)
  const [items, setItems]  = useState<Record<string, number>>({})
  const today = new Date().toISOString().split("T")[0]
  const [fecha, setFecha] = useState(today)

  function setQty(pid: string, q: number) {
    setItems(prev => {
      if (q <= 0) { const n = { ...prev }; delete n[pid]; return n }
      return { ...prev, [pid]: q }
    })
  }

  function handleCreate() {
    const itemsArr = Object.entries(items).map(([producto_id, cantidad_plan]) => ({ producto_id, cantidad_plan }))
    if (itemsArr.length === 0) { setError("Agrega al menos un producto"); return }
    setError(null)
    start(async () => {
      try {
        await crearOrdenProduccion(fecha, itemsArr)
        setOpen(false); setItems({}); router.refresh()
      } catch (err: any) {
        setError(err?.message ?? "Error al crear la orden")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5">
          <Plus className="h-3.5 w-3.5" />{forToday ? "Orden de hoy" : "Nueva orden"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva orden de producción</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {error && <p className="text-xs text-rose-600 bg-rose-50 rounded px-3 py-2">{error}</p>}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fecha</label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Productos a producir</p>
            {productos.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Primero crea productos en el catálogo.</p>}
            {productos.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.nombre}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{p.categoria}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(p.id, (items[p.id] ?? 0) - 1)} className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{items[p.id] ?? 0}</span>
                  <button onClick={() => setQty(p.id, (items[p.id] ?? 0) + 1)} className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 bg-orange-50 border-orange-200">
                    <Plus className="h-3 w-3 text-orange-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleCreate} disabled={isPending}>
              {isPending ? "Creando…" : "Crear orden"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
