"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Users, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { crearClienteCobro, editarClienteCobro } from "../../actions"

interface Cliente {
  id: string; nombre: string; cedula: string | null; telefono: string | null
  direccion: string | null; cobros: { id: string; estado: string }[]
}

function ClienteForm({ initial, onSave, onCancel, isPending }: {
  initial?: Partial<Cliente>
  onSave: (d: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [nombre,    setNombre]    = useState(initial?.nombre    ?? "")
  const [cedula,    setCedula]    = useState(initial?.cedula    ?? "")
  const [telefono,  setTelefono]  = useState(initial?.telefono  ?? "")
  const [direccion, setDireccion] = useState(initial?.direccion ?? "")

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nombre completo</Label>
        <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Cédula (opcional)</Label>
          <Input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="000-0000000-0" />
        </div>
        <div className="space-y-1.5">
          <Label>Teléfono (opcional)</Label>
          <Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="829-000-0000" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Dirección (opcional)</Label>
        <Input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, sector…" />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={isPending || !nombre}
          onClick={() => onSave({ nombre, cedula: cedula || undefined, telefono: telefono || undefined, direccion: direccion || undefined })}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  )
}

export function ClientesCobroManager({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter()
  const [isPending, start]    = useTransition()
  const [newOpen, setNewOpen] = useState(false)
  const [editItem, setEdit]   = useState<Cliente | null>(null)
  const [search, setSearch]   = useState("")

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.cedula ?? "").includes(search) ||
    (c.telefono ?? "").includes(search)
  )

  function handleCreate(data: any) {
    start(async () => { await crearClienteCobro(data); setNewOpen(false); router.refresh() })
  }
  function handleEdit(data: any) {
    if (!editItem) return
    start(async () => { await editarClienteCobro(editItem.id, data); setEdit(null); router.refresh() })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, cédula o teléfono…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" />Nuevo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
            <ClienteForm onSave={handleCreate} onCancel={() => setNewOpen(false)} isPending={isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <Users className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-lg font-semibold text-slate-700">Sin clientes</p>
          <p className="text-sm text-slate-400">Agrega clientes para gestionar sus cobros</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(c => {
          const totalCobros  = c.cobros.length
          const pendientes   = c.cobros.filter(co => ["pendiente","parcial","vencido"].includes(co.estado)).length
          return (
            <div key={c.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{c.nombre}</p>
                  {c.cedula    && <p className="text-[11px] text-slate-400 mt-0.5">{c.cedula}</p>}
                  {c.telefono  && <p className="text-[11px] text-slate-400">{c.telefono}</p>}
                  {c.direccion && <p className="text-[11px] text-slate-400 truncate">{c.direccion}</p>}
                </div>
                <button onClick={() => setEdit(c)} className="shrink-0 text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-50">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px]">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{totalCobros} cobros</span>
                {pendientes > 0 && (
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700">{pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!editItem} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          {editItem && <ClienteForm initial={editItem} onSave={handleEdit} onCancel={() => setEdit(null)} isPending={isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
