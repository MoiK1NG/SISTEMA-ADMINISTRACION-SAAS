"use client"

import { useState } from "react"
import { CheckCircle2, X, Banknote, CreditCard, Smartphone } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ItemCarrito } from "../types"

const IMPUESTO = 0.18

type MetodoPago = "efectivo" | "tarjeta" | "transferencia"

const METODOS: { id: MetodoPago; label: string; icon: React.ElementType }[] = [
  { id: "efectivo",      label: "Efectivo",      icon: Banknote    },
  { id: "tarjeta",       label: "Tarjeta",        icon: CreditCard  },
  { id: "transferencia", label: "Transferencia",  icon: Smartphone  },
]

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(n)
}

interface Props {
  open:      boolean
  items:     ItemCarrito[]
  onClose:   () => void
  onConfirmar: (metodo: MetodoPago) => void
}

export function ModalCobro({ open, items, onClose, onConfirmar }: Props) {
  const [metodo,    setMetodo]    = useState<MetodoPago>("efectivo")
  const [cobrado,   setCobrado]   = useState<string>("")
  const [procesando, setProcesando] = useState(false)
  const [exito,     setExito]     = useState(false)

  const subtotal = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)
  const impuesto = subtotal * IMPUESTO
  const total    = subtotal + impuesto
  const vuelto   = metodo === "efectivo" && Number(cobrado) > total
    ? Number(cobrado) - total
    : 0

  async function handleConfirmar() {
    setProcesando(true)
    // TODO: server action para registrar venta
    await new Promise(r => setTimeout(r, 800))
    setProcesando(false)
    setExito(true)
    setTimeout(() => {
      setExito(false)
      setCobrado("")
      setMetodo("efectivo")
      onConfirmar(metodo)
    }, 1800)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm rounded-3xl p-0 overflow-hidden gap-0">

        {/* Estado: éxito */}
        {exito ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-slate-900">¡Cobro exitoso!</p>
            <p className="text-sm text-slate-500 mt-1">{fmt(total)} procesado</p>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
              <DialogTitle className="text-lg font-bold text-slate-900">
                Procesar cobro
              </DialogTitle>
            </DialogHeader>

            <div className="px-6 py-5 space-y-5">
              {/* Total grande */}
              <div className="rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Total a cobrar</p>
                <p className="text-4xl font-black text-slate-900">{fmt(total)}</p>
                <p className="text-xs text-slate-400 mt-1">Incluye IVA {fmt(impuesto)}</p>
              </div>

              {/* Método de pago */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Método de pago
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {METODOS.map(m => {
                    const Icon = m.icon
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMetodo(m.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 text-xs font-medium transition-all ${
                          metodo === m.id
                            ? "border-slate-900 bg-slate-900 text-white shadow-md"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Monto recibido (solo efectivo) */}
              {metodo === "efectivo" && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Monto recibido
                  </p>
                  <input
                    type="number"
                    value={cobrado}
                    onChange={e => setCobrado(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-center"
                  />
                  {vuelto > 0 && (
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2">
                      <span className="text-sm text-emerald-700">Vuelto</span>
                      <span className="text-base font-bold text-emerald-700">{fmt(vuelto)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botón confirmar */}
            <div className="px-6 pb-6">
              <button
                onClick={handleConfirmar}
                disabled={procesando}
                className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {procesando
                  ? <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Procesando…
                    </span>
                  : "✅ Confirmar cobro"
                }
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
