"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { crearCategoria, crearMenuItem, editarMenuItem } from "../../actions"

interface Categoria { id: string; nombre: string; orden: number }
interface MenuItem  {
  id: string; nombre: string; descripcion: string | null
  precio: number; disponible: boolean; categoria_id: string | null
  menu_categorias: { nombre: string } | null
}

const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

function ItemForm({ initial, categorias, onSave, onCancel, isPending }: {
  initial?: Partial<MenuItem>
  categorias: Categoria[]
  onSave: (d: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [nombre,      setNombre]      = useState(initial?.nombre      ?? "")
  const [desc,        setDesc]        = useState(initial?.descripcion ?? "")
  const [precio,      setPrecio]      = useState(String(initial?.precio ?? ""))
  const [catId,       setCatId]       = useState(initial?.categoria_id ?? "__none__")
  const [disponible,  setDisponible]  = useState(initial?.disponible ?? true)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nombre</Label>
        <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Pollo al horno" />
      </div>
      <div className="space-y-1.5">
        <Label>Descripción (opcional)</Label>
        <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción breve del plato…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Precio (COP)</Label>
          <Input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select value={catId} onValueChange={setCatId}>
            <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin categoría</SelectItem>
              {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="disp" checked={disponible} onChange={e => setDisponible(e.target.checked)} className="h-4 w-4 accent-red-600" />
        <Label htmlFor="disp">Disponible en el menú</Label>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={isPending || !nombre || !precio}
          onClick={() => onSave({ nombre, descripcion: desc || null, precio: Number(precio), disponible, categoria_id: catId === "__none__" ? null : catId })}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  )
}

export function MenuManager({ items, categorias }: { items: MenuItem[]; categorias: Categoria[] }) {
  const router = useRouter()
  const [isPending, start]      = useTransition()
  const [newItemOpen, setNIO]   = useState(false)
  const [newCatOpen, setNCO]    = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [catNombre, setCatNombre] = useState("")
  const [search, setSearch]     = useState("")

  const filtered = items.filter(i => i.nombre.toLowerCase().includes(search.toLowerCase()))

  const byCategory: Record<string, MenuItem[]> = {}
  for (const item of filtered) {
    const key = item.categoria_id ?? "__none__"
    ;(byCategory[key] = byCategory[key] ?? []).push(item)
  }

  function handleCreateItem(data: any) {
    start(async () => { await crearMenuItem(data); setNIO(false); router.refresh() })
  }
  function handleEditItem(data: any) {
    if (!editItem) return
    start(async () => { await editarMenuItem(editItem.id, data); setEditItem(null); router.refresh() })
  }
  function handleCreateCat() {
    if (!catNombre) return
    start(async () => { await crearCategoria(catNombre, categorias.length + 1); setNCO(false); setCatNombre(""); router.refresh() })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Buscar en el menú…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
        <Dialog open={newCatOpen} onOpenChange={setNCO}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0"><Plus className="h-3.5 w-3.5" />Categoría</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <Input value={catNombre} onChange={e => setCatNombre(e.target.value)} placeholder="Ej: Entradas, Postres…" />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setNCO(false)}>Cancelar</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={isPending || !catNombre} onClick={handleCreateCat}>
                  {isPending ? "…" : "Crear"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={newItemOpen} onOpenChange={setNIO}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" />Nuevo plato
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Nuevo item en el menú</DialogTitle></DialogHeader>
            <ItemForm categorias={categorias} onSave={handleCreateItem} onCancel={() => setNIO(false)} isPending={isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-lg font-semibold text-slate-700">Sin items</p>
          <p className="text-sm text-slate-400">Agrega platos al menú para empezar</p>
        </div>
      )}

      {Object.entries(byCategory).map(([catId, catItems]) => {
        const cat = categorias.find(c => c.id === catId)
        return (
          <div key={catId}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{cat?.nombre ?? "Sin categoría"}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {catItems.map(item => (
                <div key={item.id} className={`rounded-xl border bg-white p-3.5 shadow-sm flex items-start justify-between gap-2 ${!item.disponible ? "opacity-50" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.nombre}</p>
                    {item.descripcion && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.descripcion}</p>}
                    <p className="text-sm font-bold text-red-600 mt-1">{fmt(item.precio)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button onClick={() => setEditItem(item)} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-50">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {item.disponible ? <Eye className="h-3 w-3 text-emerald-500" /> : <EyeOff className="h-3 w-3 text-slate-300" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <Dialog open={!!editItem} onOpenChange={o => !o && setEditItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar plato</DialogTitle></DialogHeader>
          {editItem && <ItemForm initial={editItem} categorias={categorias} onSave={handleEditItem} onCancel={() => setEditItem(null)} isPending={isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
