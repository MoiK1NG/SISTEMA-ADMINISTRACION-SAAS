"use client"

import { Plus, Minus, Trash2, ShoppingBag, Receipt } from "lucide-react"
import type { ItemCarrito } from "../types"

const IMPUESTO = 0.18   // ITBIS 18%

interface Props {
  items:      ItemCarrito[]
  onSumar:    (id: string) => void
  onRestar:   (id: string) => void
  onEliminar: (id: string) => void
  onCobrar:   () => void
  onLimpiar:  () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency", currency: "DOP", minimumFractionDigits: 2,
  }).format(n)
}

export function Carrito({ items, onSumar, onRestar, onEliminar, onCobrar, onLimpiar }: Props) {
  const subtotal  = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)
  const impuesto  = subtotal * IMPUESTO
  const total     = subtotal + impuesto
  const totalItems = items.reduce((s, i) => s + i.cantidad, 0)

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900">
            <Receipt className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-none">Ticket actual</p>
            <p className="text-xs text-slate-400 mt-0.5">{totalItems} {totalItems === 1 ? "ítem" : "ítems"}</p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={onLimpiar}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* ── Lista de ítems ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-3">
              <ShoppingBag className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">Carrito vacío</p>
            <p className="text-xs text-slate-300 mt-1">Toca un producto para agregarlo</p>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.producto.id}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 group"
            >
              {/* Emoji */}
              <span className="text-2xl shrink-0">{item.producto.emoji}</span>

              {/* Nombre + precio unit */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 leading-tight truncate">
                  {item.producto.nombre}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {fmt(item.producto.precio)} c/u
                </p>
              </div>

              {/* Controles cantidad */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onRestar(item.producto.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
                >
                  <Minus className="h-3 w-3" />
                </button>

                <span className="w-6 text-center text-sm font-bold text-slate-900 tabular-nums">
                  {item.cantidad}
                </span>

                <button
                  onClick={() => onSumar(item.producto.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700 transition-all active:scale-90"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Subtotal del ítem */}
              <p className="text-xs font-bold text-slate-900 w-16 text-right shrink-0">
                {fmt(item.producto.precio * item.cantidad)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* ── Totales + Cobrar ─────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 px-5 pt-4 pb-5 space-y-4">

        {/* Desglose */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-700">{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">ITBIS (18%)</span>
            <span className="font-medium text-slate-700">{fmt(impuesto)}</span>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-900">Total</span>
            <span className="text-2xl font-black text-slate-900">{fmt(total)}</span>
          </div>
        </div>

        {/* Botón Cobrar */}
        <button
          onClick={onCobrar}
          disabled={items.length === 0}
          className={`w-full rounded-2xl py-4 text-base font-bold tracking-wide transition-all duration-150 ${
            items.length === 0
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-emerald-500/40 hover:shadow-xl active:scale-[0.98]"
          }`}
        >
          {items.length === 0 ? "Agrega productos" : `💳 Cobrar ${fmt(total)}`}
        </button>
      </div>
    </div>
  )
}
