"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { agregarItemOrden } from "../../../actions"

interface MenuItem { id: string; nombre: string; precio: number; menu_categorias?: { nombre: string } | null }

export function AgregarItemButton({ ordenId, menuItems }: { ordenId: string; menuItems: MenuItem[] }) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState("")
  const [selected, setSelected] = useState<MenuItem | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [nota, setNota]         = useState("")
  const [isPending, start]      = useTransition()
  const [error, setError]       = useState<string | null>(null)

  const filtrados = menuItems.filter(m => m.nombre.toLowerCase().includes(search.toLowerCase()))

  function handleAdd() {
    if (!selected) { setError("Selecciona un item"); return }
    setError(null)
    start(async () => {
      try {
        await agregarItemOrden(ordenId, selected.id, cantidad, nota || undefined)
        setOpen(false)
        setSelected(null); setSearch(""); setCantidad(1); setNota("")
        router.refresh()
      } catch (err: any) {
        setError(err?.message ?? "Error al agregar item")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Agregar item</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Agregar a la orden</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {error && <p className="text-xs text-rose-600 bg-rose-50 rounded px-3 py-2">{error}</p>}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar en el menú…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-100">
            {filtrados.length === 0 && <p className="text-sm text-center py-4 text-slate-400">Sin resultados</p>}
            {filtrados.map(item => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${selected?.id === item.id ? "bg-red-50 font-medium text-red-700" : ""}`}
              >
                <span>{item.nombre}</span>
                <span className="text-slate-500">{new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(item.precio)}</span>
              </button>
            ))}
          </div>
          {selected && (
            <>
              <div className="space-y-1.5">
                <Label>Cantidad</Label>
                <Input type="number" min="1" value={cantidad} onChange={e => setCantidad(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Nota (opcional)</Label>
                <Input placeholder="Ej: sin cebolla" value={nota} onChange={e => setNota(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleAdd} disabled={!selected || isPending}>
              {isPending ? "Agregando…" : "Agregar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
