"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DollarSign, Calendar, FileText, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { registrarPago } from "../../actions"

interface Props {
  prestamoId: string
  proximaCuota?: { monto_cuota: number } | null
  disabled?: boolean
}

export function RegistrarPagoButton({ prestamoId, proximaCuota, disabled }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const monto = Number(form.get("monto"))
    const fecha = form.get("fecha") as string
    const nota  = (form.get("nota") as string) || undefined

    if (!monto || monto <= 0) {
      setError("El monto debe ser mayor a cero")
      return
    }

    startTransition(async () => {
      try {
        await registrarPago(prestamoId, monto, fecha, nota)
        setOpen(false)
        router.refresh()
      } catch (err: any) {
        setError(err?.message ?? "Error al registrar el pago")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={disabled}
          className="gap-1.5 shadow-sm shadow-primary/20 hover:shadow-primary/30 transition-all"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Registrar pago
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            El pago se aplicará a la cuota pendiente más antigua.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <p className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="monto" className="text-sm font-medium">Monto (DOP)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="monto"
                name="monto"
                type="number"
                min="1"
                step="0.01"
                placeholder={proximaCuota ? String(proximaCuota.monto_cuota) : "0.00"}
                defaultValue={proximaCuota?.monto_cuota ?? ""}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fecha" className="text-sm font-medium">Fecha del pago</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fecha"
                name="fecha"
                type="date"
                className="pl-9"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nota" className="text-sm font-medium">Nota (opcional)</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="nota"
                name="nota"
                placeholder="Ej: Pago en efectivo"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Guardando…
                </span>
              ) : "Confirmar pago"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
