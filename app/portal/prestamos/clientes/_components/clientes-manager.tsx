"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, User, Phone, MapPin, IdCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { editarCliente, eliminarCliente } from "../../actions"

export interface ClienteData {
  id: string
  nombre: string
  cedula: string | null
  telefono: string | null
  direccion: string | null
  prestamos_count: number
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function ClienteCard({ cliente }: { cliente: ClienteData }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const nombre = form.get("nombre") as string
    if (!nombre.trim()) { setError("El nombre es requerido"); return }

    startTransition(async () => {
      try {
        await editarCliente(cliente.id, {
          nombre:    nombre.trim(),
          cedula:    (form.get("cedula")    as string) || undefined,
          telefono:  (form.get("telefono")  as string) || undefined,
          direccion: (form.get("direccion") as string) || undefined,
        })
        setEditOpen(false)
        router.refresh()
      } catch (err: any) {
        setError(err?.message ?? "Error al actualizar")
      }
    })
  }

  async function handleDelete() {
    try {
      await eliminarCliente(cliente.id)
      router.refresh()
    } catch (err: any) {
      alert(err?.message ?? "Error al eliminar")
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-all">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {getInitials(cliente.nombre)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-none truncate">{cliente.nombre}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
            {cliente.cedula    && <span className="flex items-center gap-1"><IdCard   className="h-3 w-3" />{cliente.cedula}</span>}
            {cliente.telefono  && <span className="flex items-center gap-1"><Phone    className="h-3 w-3" />{cliente.telefono}</span>}
            {cliente.direccion && <span className="flex items-center gap-1"><MapPin   className="h-3 w-3" />{cliente.direccion}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {cliente.prestamos_count} préstamo{cliente.prestamos_count !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-900"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-rose-600"
            disabled={cliente.prestamos_count > 0}
            title={cliente.prestamos_count > 0 ? "Tiene préstamos activos" : "Eliminar cliente"}
            onClick={() => {
              if (window.confirm(`¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`)) {
                handleDelete()
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Modal de edición */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Actualiza los datos de {cliente.nombre}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="mt-2 space-y-4">
            {error && (
              <p className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{error}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-sm font-medium">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="nombre" name="nombre" defaultValue={cliente.nombre} className="pl-9" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cedula" className="text-sm font-medium">Cédula / ID</Label>
                <Input id="cedula" name="cedula" defaultValue={cliente.cedula ?? ""} placeholder="000-0000000-0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono" className="text-sm font-medium">Teléfono</Label>
                <Input id="telefono" name="telefono" defaultValue={cliente.telefono ?? ""} placeholder="809-000-0000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direccion" className="text-sm font-medium">Dirección</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="direccion" name="direccion" defaultValue={cliente.direccion ?? ""} className="pl-9" placeholder="Ciudad, sector" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ClientesManager({ clientes }: { clientes: ClienteData[] }) {
  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
          <User className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-900">Sin clientes aún</p>
        <p className="text-xs text-slate-500 mt-1">Los clientes aparecen aquí cuando creas un préstamo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {clientes.map((c) => (
        <ClienteCard key={c.id} cliente={c} />
      ))}
    </div>
  )
}
