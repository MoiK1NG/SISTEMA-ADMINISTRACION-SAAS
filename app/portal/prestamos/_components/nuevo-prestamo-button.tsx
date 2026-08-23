"use client"

// ─── Client Component: ÚNICO lugar que necesita interactividad ───────────────
// Gestiona el estado abierto/cerrado del modal de nuevo préstamo.
// Todo lo demás en la página es Server Component puro.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, User, DollarSign, Calendar, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { crearPrestamo, type FrecuenciaPago } from "../actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function NuevoPrestamoButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)

    try {
      await crearPrestamo({
        cliente_nombre:   form.get("cliente")    as string,
        cliente_cedula:   form.get("cedula")     as string || undefined,
        cliente_telefono: form.get("telefono")   as string || undefined,
        monto_principal:  Number(form.get("monto")),
        tasa_interes:     Number(form.get("tasa")) / 100,  // % → decimal
        frecuencia:       form.get("frecuencia") as FrecuenciaPago,
        num_cuotas:       Number(form.get("plazo")),
        fecha_inicio:     form.get("fecha_inicio") as string,
      })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? "Error al crear el préstamo")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Botón principal — versión desktop (oculto en mobile, reemplazado por FAB) */}
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="hidden sm:inline-flex gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:shadow-xl transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Nuevo Préstamo
        </Button>
      </DialogTrigger>

      {/* FAB — versión móvil, fijo en esquina inferior derecha */}
      <DialogTrigger asChild>
        <button
          aria-label="Nuevo préstamo"
          className="fixed bottom-6 right-6 z-40 sm:hidden flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <Plus className="h-6 w-6" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo Préstamo</DialogTitle>
          <DialogDescription>
            Completa los datos del préstamo. Podrás editar los detalles después.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">

          {/* Error global */}
          {error && (
            <p className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="cliente" className="text-sm font-medium">Cliente</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="cliente" name="cliente" placeholder="Nombre completo" className="pl-9" required />
            </div>
          </div>

          {/* Cédula + Teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cedula" className="text-sm font-medium">Cédula / ID</Label>
              <Input id="cedula" name="cedula" placeholder="000-0000000-0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefono" className="text-sm font-medium">Teléfono</Label>
              <Input id="telefono" name="telefono" placeholder="809-000-0000" />
            </div>
          </div>

          {/* Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="monto" className="text-sm font-medium">Monto (COP)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="monto" name="monto" type="number" min="1" step="0.01" placeholder="0.00" className="pl-9" required />
            </div>
          </div>

          {/* Tasa + Frecuencia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tasa" className="text-sm font-medium">Tasa por período (%)</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="tasa" name="tasa" type="number" min="0" max="100" step="0.01" placeholder="5.00" className="pl-9" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frecuencia" className="text-sm font-medium">Frecuencia</Label>
              <Select name="frecuencia" defaultValue="mensual" required>
                <SelectTrigger id="frecuencia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diario</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Número de cuotas + Fecha inicio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plazo" className="text-sm font-medium">Nº de cuotas</Label>
              <Input id="plazo" name="plazo" type="number" min="1" max="360" placeholder="12" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha_inicio" className="text-sm font-medium">Fecha inicio</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fecha_inicio"
                  name="fecha_inicio"
                  type="date"
                  className="pl-9"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Guardando…
                </span>
              ) : (
                "Crear préstamo"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
