"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Receipt, Banknote, CreditCard, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cerrarOrden } from "../../../actions"

interface Props { ordenId: string; total: number; fullWidth?: boolean }

const METODOS = [
  { value: "efectivo",     label: "Efectivo",      icon: Banknote         },
  { value: "tarjeta",      label: "Tarjeta",        icon: CreditCard       },
  { value: "transferencia",label: "Transferencia",  icon: ArrowLeftRight   },
]

export function CerrarOrdenButton({ ordenId, total, fullWidth }: Props) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [metodo, setMetodo] = useState("efectivo")
  const [isPending, start]  = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const fmt = (n: number) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(n)

  function handleCerrar() {
    setError(null)
    start(async () => {
      try {
        await cerrarOrden(ordenId, total, metodo)
        setOpen(false)
        router.push("/portal/restaurante")
      } catch (err: any) {
        setError(err?.message ?? "Error al cerrar la orden")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={`bg-red-600 hover:bg-red-700 gap-1.5 ${fullWidth ? "w-full" : ""}`} size={fullWidth ? "default" : "sm"}>
          <Receipt className="h-3.5 w-3.5" /> Cobrar {fmt(total)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader><DialogTitle>Cerrar orden</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {error && <p className="text-xs text-rose-600 bg-rose-50 rounded px-3 py-2">{error}</p>}
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
            <p className="text-xs text-slate-500">Total a cobrar</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{fmt(total)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Método de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMetodo(m.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-medium transition-all ${
                    metodo === m.value ? "border-red-600 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <m.icon className="h-4 w-4" />{m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleCerrar} disabled={isPending}>
              {isPending ? "Cerrando…" : "Confirmar cobro"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
