"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { crearProductoPos, editarProductoPos, eliminarProductoPos } from "../../actions"
import { CATEGORIAS_POS, type CategoriaPos } from "../../constants"

interface ProductoPos {
  id: string; nombre: string; categoria: CategoriaPos; emoji: string; precio: number; disponible: boolean
}

const CATEGORIA_LABELS: Record<CategoriaPos, string> = {
  panes: "Panes", postres: "Postres", bebidas: "Bebidas", salados: "Salados", otros: "Otros",
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const FORM_VACIO = { nombre: "", categoria: "otros" as CategoriaPos, emoji: "🛒", precio: 0, disponible: true }

export function ProductosPosManager({ productos }: { productos: ProductoPos[] }) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<ProductoPos | null>(null)
  const [form, setForm]       = useState(FORM_VACIO)
  const [error, setError]     = useState<string | null>(null)
  const [isPending, start]    = useTransition()

  function openNew() {
    setEditing(null); setForm(FORM_VACIO); setError(null); setOpen(true)
  }
  function openEdit(p: ProductoPos) {
    setEditing(p)
    setForm({ nombre: p.nombre, categoria: p.categoria, emoji: p.emoji, precio: p.precio, disponible: p.disponible })
    setError(null); setOpen(true)
  }

  function handleSave() {
    setError(null)
    start(async () => {
      try {
        if (editing) await editarProductoPos(editing.id, form)
        else         await crearProductoPos(form)
        setOpen(false)
        router.refresh()
      } catch (err: any) {
        setError(err?.message ?? "Error al guardar el producto")
      }
    })
  }

  function handleDelete(p: ProductoPos) {
    if (!confirm(`¿Eliminar "${p.nombre}"? Las ventas anteriores conservan su historial.`)) return
    start(async () => {
      try {
        await eliminarProductoPos(p.id)
        router.refresh()
      } catch (err: any) {
        alert(err?.message ?? "Error al eliminar")
      }
    })
  }

  // Agrupar por categoría
  const grupos = CATEGORIAS_POS
    .map(cat => ({ cat, items: productos.filter(p => p.categoria === cat) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {productos.length} {productos.length === 1 ? "producto" : "productos"} en el catálogo
        </p>
        <Button size="sm" onClick={openNew} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
          <Plus className="h-3.5 w-3.5" />Nuevo producto
        </Button>
      </div>

      {productos.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-sm font-medium text-slate-700">Sin productos aún</p>
          <p className="mt-1 text-xs text-slate-400">Crea el primero con el botón de arriba</p>
        </div>
      )}

      {grupos.map(({ cat, items }) => (
        <div key={cat}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            {CATEGORIA_LABELS[cat]} · {items.length}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(p => (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm ${
                  p.disponible ? "border-slate-100" : "border-slate-100 opacity-60"
                }`}
              >
                <span className="text-3xl shrink-0">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.nombre}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-bold text-violet-600">{fmt(p.precio)}</p>
                    {!p.disponible && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        No disponible
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Dialog crear/editar ─────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {error && <p className="text-xs text-rose-600 bg-rose-50 rounded px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <div className="space-y-1.5 w-20">
                <Label>Emoji</Label>
                <Input
                  value={form.emoji}
                  onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                  className="text-center text-lg"
                />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Café americano"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="space-y-1.5 flex-1">
                <Label>Categoría</Label>
                <select
                  value={form.categoria}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaPos }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIAS_POS.map(c => (
                    <option key={c} value={c}>{CATEGORIA_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Precio (COP)</Label>
                <Input
                  type="number" min="0" step="50"
                  value={form.precio || ""}
                  onChange={e => setForm(f => ({ ...f, precio: Number(e.target.value) }))}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.disponible}
                onChange={e => setForm(f => ({ ...f, disponible: e.target.checked }))}
                className="rounded"
              />
              Disponible para la venta
            </label>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700"
                onClick={handleSave}
                disabled={isPending || !form.nombre.trim()}
              >
                {isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
