"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import type { Producto, Categoria, ItemCarrito } from "../types"

const CATEGORIAS: { id: Categoria; label: string; emoji: string }[] = [
  { id: "todos",   label: "Todos",   emoji: "🍽️" },
  { id: "panes",   label: "Panes",   emoji: "🍞" },
  { id: "postres", label: "Postres", emoji: "🍰" },
  { id: "bebidas", label: "Bebidas", emoji: "☕" },
  { id: "salados", label: "Salados", emoji: "🥐" },
  { id: "otros",   label: "Otros",   emoji: "🛒" },
]

interface Props {
  productos:  Producto[]
  carrito:    ItemCarrito[]
  onAgregar:  (producto: Producto) => void
}

export function Catalogo({ productos, carrito, onAgregar }: Props) {
  const [busqueda,   setBusqueda]   = useState("")
  const [categoria,  setCategoria]  = useState<Categoria>("todos")

  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      const coincideCategoria = categoria === "todos" || p.categoria === categoria
      const coincideBusqueda  = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
      return coincideCategoria && coincideBusqueda && p.disponible
    })
  }, [productos, categoria, busqueda])

  // Cantidad en carrito para badge visual
  const cantidadEnCarrito = (id: string) =>
    carrito.find(i => i.producto.id === id)?.cantidad ?? 0

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Barra de búsqueda ─────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full h-12 rounded-2xl border border-slate-200 bg-white pl-12 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-all"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Pills de categorías ───────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIAS.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoria(cat.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
              categoria === cat.id
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-[1.03]"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <span>{cat.emoji}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Grid de productos ─────────────────────────────────────────────── */}
      {productosFiltrados.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm font-medium text-slate-700">Sin resultados</p>
          <p className="mt-1 text-xs text-slate-400">Intenta con otro término o categoría</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto flex-1 pb-2">
          {productosFiltrados.map(producto => {
            const enCarrito = cantidadEnCarrito(producto.id)

            return (
              <button
                key={producto.id}
                onClick={() => onAgregar(producto)}
                className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-4 text-center shadow-sm transition-all duration-150 active:scale-95 hover:scale-[1.03] hover:shadow-md ${
                  enCarrito > 0
                    ? "border-primary/40 ring-2 ring-primary/20"
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                {/* Badge cantidad */}
                {enCarrito > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white shadow">
                    {enCarrito}
                  </span>
                )}

                {/* Emoji placeholder */}
                <span className="text-4xl leading-none transition-transform duration-150 group-hover:scale-110">
                  {producto.emoji}
                </span>

                {/* Info */}
                <div className="w-full">
                  <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">
                    {producto.nombre}
                  </p>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {fmt(producto.precio)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(n)
}
