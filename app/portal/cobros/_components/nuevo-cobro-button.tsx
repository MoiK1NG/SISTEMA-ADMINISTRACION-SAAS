"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, User, DollarSign, Calendar, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { crearCobro } from "../actions"

export function NuevoCobroButton() {
  const router   = useRouter()
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null)
    const form = new FormData(e.currentTarget)
    try {
      await crearCobro({
        cliente_nombre:   form.get("cliente")    as string,
        cliente_cedula:   (form.get("cedula")    as string) || undefined,
        cliente_telefono: (form.get("telefono")  as string) || undefined,
        descripcion:      form.get("descripcion") as string,
        monto_total:      Number(form.get("monto")),
        fecha_vencimiento: (form.get("vencimiento") as string) || undefined,
        notas:            (form.get("notas") as string) || undefined,
      })
      setOpen(false); router.refresh()
    } catch (err: any) {
      setError(err?.message ?? "Error al crear el cobro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="hidden sm:inline-flex gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/25">
          <Plus className="h-4 w-4" /> Nuevo Cobro
        </Button>
      </DialogTrigger>
      <DialogTrigger asChild>
        <button aria-label="Nuevo cobro" className="fixed bottom-6 right-6 z-40 sm:hidden flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
          <Plus className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Cobro</DialogTitle>
          <DialogDescription>Registra una cuenta por cobrar a un cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && <p className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input name="cliente" placeholder="Nombre completo" className="pl-9" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cédula / ID</Label>
              <Input name="cedula" placeholder="000-0000000-0" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input name="telefono" placeholder="809-000-0000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input name="descripcion" placeholder="Ej: Mercancía al fiado — mayo 2026" className="pl-9" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto (DOP)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input name="monto" type="number" min="1" step="0.01" placeholder="0.00" className="pl-9" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de vencimiento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input name="vencimiento" type="date" className="pl-9" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Input name="notas" placeholder="Observaciones adicionales" />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? "Guardando…" : "Crear cobro"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
