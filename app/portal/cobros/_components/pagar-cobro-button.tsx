"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DollarSign, Calendar, FileText, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { registrarPagoCobro } from "../actions"

interface Props { cobroId: string; saldoPendiente: number }

export function PagarCobroButton({ cobroId, saldoPendiente }: Props) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [isPending, start]    = useTransition()
  const [error, setError]     = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form  = new FormData(e.currentTarget)
    const monto = Number(form.get("monto"))
    const fecha = form.get("fecha") as string
    const nota  = (form.get("nota") as string) || undefined
    if (!monto || monto <= 0) { setError("Monto inválido"); return }

    start(async () => {
      try {
        await registrarPagoCobro(cobroId, monto, fecha, nota)
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
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
          <CreditCard className="h-3.5 w-3.5" /> Cobrar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Saldo pendiente: <strong>{new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(saldoPendiente)}</strong></DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && <p className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto (COP)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="monto" name="monto" type="number" min="1" step="0.01" defaultValue={saldoPendiente} className="pl-9" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="fecha" name="fecha" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="pl-9" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nota">Nota (opcional)</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="nota" name="nota" placeholder="Ej: pago en efectivo" className="pl-9" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={isPending}>
              {isPending ? "Guardando…" : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
