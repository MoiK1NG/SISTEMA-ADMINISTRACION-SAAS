"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { crearProducto, editarProducto } from "../../actions"

interface Producto {
  id: string; nombre: string; categoria: string; precio_venta: number
  costo_produccion: number; unidad: string; activo: boolean
}

const CATEGORIAS = ["pan", "pastel", "galleta", "hojaldre", "torta", "dulce", "bebida", "otro"]
const UNIDADES   = ["unidad", "docena", "libra", "kg", "bandeja"]

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}

function ProductoForm({ initial, onSave, onCancel, isPending }: {
  initial?: Partial<Producto>
  onSave: (d: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [nombre,   setNombre]   = useState(initial?.nombre   ?? "")
  const [cat,      setCat]      = useState(initial?.categoria ?? "pan")
  const [precio,   setPrecio]   = useState(String(initial?.precio_venta     ?? ""))
  const [costo,    setCosto]    = useState(String(initial?.costo_produccion ?? ""))
  const [unidad,   setUnidad]   = useState(initial?.unidad   ?? "unidad")
  const [activo,   setActivo]   = useState(initial?.activo   ?? true)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Pan de agua" />
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Unidad</Label>
          <Select value={unidad} onValueChange={setUnidad}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Precio de venta (COP)</Label>
          <Input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Costo producción (COP)</Label>
          <Input type="number" min="0" step="0.01" value={costo} onChange={e => setCosto(e.target.value)} />
        </div>
        {initial?.id && (
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="activo" checked={activo} onChange={e => setActivo(e.target.checked)} className="h-4 w-4 accent-orange-500" />
            <Label htmlFor="activo">Producto activo</Label>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={isPending || !nombre}
          onClick={() => onSave({ nombre, categoria: cat, precio_venta: Number(precio), costo_produccion: Number(costo), unidad, activo })}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  )
}

export function ProductosManager({ productos }: { productos: Producto[] }) {
  const router = useRouter()
  const [newOpen, setNewOpen]     = useState(false)
  const [editItem, setEditItem]   = useState<Producto | null>(null)
  const [isPending, start]        = useTransition()
  const [search, setSearch]       = useState("")

  const filtered = productos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()))

  function handleCreate(data: any) {
    start(async () => { await crearProducto(data); setNewOpen(false); router.refresh() })
  }

  function handleEdit(data: any) {
    if (!editItem) return
    start(async () => { await editarProducto(editItem.id, data); setEditItem(null); router.refresh() })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Buscar productos…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" />Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Nuevo producto</DialogTitle></DialogHeader>
            <ProductoForm onSave={handleCreate} onCancel={() => setNewOpen(false)} isPending={isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <Package className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-lg font-semibold text-slate-700">Sin productos</p>
          <p className="text-sm text-slate-400">Agrega tu primer producto al catálogo</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(p => (
          <div key={p.id} className={`rounded-xl border bg-white p-4 shadow-sm ${!p.activo ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{p.nombre}</p>
                <p className="text-[11px] text-slate-400 capitalize mt-0.5">{p.categoria} · {p.unidad}</p>
              </div>
              <button onClick={() => setEditItem(p)} className="shrink-0 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-50">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Venta</p>
                <p className="text-sm font-bold text-orange-600">{fmt(p.precio_venta)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Costo</p>
                <p className="text-sm font-semibold text-slate-600">{fmt(p.costo_produccion)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Margen</p>
                <p className="text-sm font-semibold text-emerald-600">
                  {p.precio_venta > 0 ? Math.round(((p.precio_venta - p.costo_produccion) / p.precio_venta) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={o => !o && setEditItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar producto</DialogTitle></DialogHeader>
          {editItem && <ProductoForm initial={editItem} onSave={handleEdit} onCancel={() => setEditItem(null)} isPending={isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
