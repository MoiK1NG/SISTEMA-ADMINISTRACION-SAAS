"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Minus, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { registrarVenta } from "../../actions"

interface Producto { id: string; nombre: string; precio_venta: number; unidad: string }

export function NuevaVentaButton({ productos }: { productos: Producto[] }) {
  const router = useRouter()
  const [open, setOpen]    = useState(false)
  const [isPending, start] = useTransition()
  const [error, setError]  = useState<string | null>(null)
  const [qtys, setQtys]    = useState<Record<string, number>>({})
  const [notas, setNotas]  = useState("")
  const today = new Date().toISOString().split("T")[0]
  const [fecha, setFecha]  = useState(today)

  const fmt = (n: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)

  function setQty(id: string, q: number) {
    setQtys(prev => {
      if (q <= 0) { const n = { ...prev }; delete n[id]; return n }
      return { ...prev, [id]: q }
    })
  }

  const total = Object.entries(qtys).reduce((acc, [id, q]) => {
    const p = productos.find(p => p.id === id)
    return acc + (p ? p.precio_venta * q : 0)
  }, 0)

  function handleCreate() {
    const items = Object.entries(qtys).map(([producto_id, cantidad]) => {
      const p = productos.find(p => p.id === producto_id)!
      return { producto_id, cantidad, precio_unitario: p.precio_venta }
    })
    if (items.length === 0) { setError("Agrega al menos un producto"); return }
    setError(null)
    start(async () => {
      try {
        await registrarVenta(fecha, items, notas || undefined)
        setOpen(false); setQtys({}); setNotas(""); router.refresh()
      } catch (err: any) {
        setError(err?.message ?? "Error al registrar venta")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5">
          <Plus className="h-3.5 w-3.5" />Nueva venta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar venta</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {error && <p className="text-xs text-rose-600 bg-rose-50 rounded px-3 py-2">{error}</p>}
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Productos</p>
            {productos.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No hay productos activos en el catálogo.</p>}
            {productos.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.nombre}</p>
                  <p className="text-[10px] text-slate-400">{fmt(p.precio_venta)} / {p.unidad}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(p.id, (qtys[p.id] ?? 0) - 1)} className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{qtys[p.id] ?? 0}</span>
                  <button onClick={() => setQty(p.id, (qtys[p.id] ?? 0) + 1)} className="h-7 w-7 rounded-lg border border-orange-200 bg-orange-50 flex items-center justify-center hover:bg-orange-100">
                    <Plus className="h-3 w-3 text-orange-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div className="rounded-lg bg-orange-50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-orange-700">Total</span>
              <span className="text-lg font-bold text-orange-700">{fmt(total)}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Input placeholder="Observaciones de la venta…" value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleCreate} disabled={isPending}>
              {isPending ? "Registrando…" : "Registrar venta"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
