"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Plus, ScanBarcode, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CADUCIDAD_META, type EstadoCaducidad } from "@/lib/farmacia/caducidad"
import { ProductoFormDialog } from "./producto-form"

export interface CatalogoItem { id: string; nombre: string }

export interface FilaProducto {
  id:               string
  codigo_barras:    string | null
  nombre:           string
  principio_activo: string | null
  concentracion:    string | null
  presentacion:     string | null
  categoria:        string
  registro_invima:  string | null
  precio_venta:     number
  costo:            number | null   // null para el cajero
  requiere_receta:  boolean
  activo:           boolean
  laboratorio_id:   string | null
  proveedor_id:     string | null
  stock_venta:      number
  stock_bodega:     number
  vence:            string | null
  semaforo:         EstadoCaducidad | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso + "T00:00:00"))

type Filtro = "todos" | "por_vencer" | "sin_stock" | "inactivos"

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos",      label: "Todos"        },
  { id: "por_vencer", label: "🔴 Por vencer" },
  { id: "sin_stock",  label: "Sin stock"    },
  { id: "inactivos",  label: "Inactivos"    },
]

interface Props {
  filas:        FilaProducto[]
  proveedores:  CatalogoItem[]
  laboratorios: CatalogoItem[]
  esGestor:     boolean
}

export function InventarioFarmacia({ filas, proveedores, laboratorios, esGestor }: Props) {
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro]     = useState<Filtro>("todos")
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<FilaProducto | null>(null)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter(f => {
      if (filtro === "por_vencer" && !(f.semaforo === "rojo" || f.semaforo === "vencido")) return false
      if (filtro === "sin_stock"  && f.stock_venta + f.stock_bodega > 0) return false
      if (filtro === "inactivos"  && f.activo) return false
      if (filtro !== "inactivos"  && !f.activo) return false
      if (!q) return true
      return (
        f.nombre.toLowerCase().includes(q) ||
        (f.principio_activo ?? "").toLowerCase().includes(q) ||
        (f.codigo_barras ?? "").includes(q)
      )
    })
  }, [filas, busqueda, filtro])

  const alertas = filas.filter(f => f.activo && (f.semaforo === "rojo" || f.semaforo === "vencido")).length

  return (
    <div className="space-y-4">

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            placeholder="Buscar o escanear: nombre, principio activo o código…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="h-11 rounded-xl pl-10"
          />
          <ScanBarcode className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
        </div>
        {esGestor && (
          <Button
            onClick={() => { setEditando(null); setFormAbierto(true) }}
            className="gap-1.5 bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />Nuevo producto
          </Button>
        )}
      </div>

      {/* ── Filtros + alerta ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filtro === f.id
                ? "bg-teal-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        {alertas > 0 && filtro !== "por_vencer" && (
          <button
            onClick={() => setFiltro("por_vencer")}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700"
          >
            <AlertTriangle className="h-3 w-3" />
            {alertas} por vencer
          </button>
        )}
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Producto</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Principio activo</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Venta</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Bodega</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Vence</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Precio</th>
              {esGestor && <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Costo</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visibles.length === 0 && (
              <tr>
                <td colSpan={esGestor ? 7 : 6} className="py-16 text-center">
                  <p className="text-3xl">💊</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {filas.length === 0 ? "El inventario está vacío" : "Sin resultados"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {filas.length === 0
                      ? esGestor ? "Crea el primer producto con el botón de arriba" : "El dueño o regente deben cargar el catálogo"
                      : "Proba con otro término u otro filtro"}
                  </p>
                </td>
              </tr>
            )}

            {visibles.map(f => {
              const sem = f.semaforo ? CADUCIDAD_META[f.semaforo] : null
              const sinStock = f.stock_venta + f.stock_bodega <= 0
              return (
                <tr key={f.id} className="group transition-colors hover:bg-teal-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/portal/farmacia/inventario/${f.id}`} className="block">
                      <p className="font-semibold text-slate-900 group-hover:text-teal-700">
                        {f.nombre}
                        {f.concentracion && <span className="ml-1 font-normal text-slate-400">{f.concentracion}</span>}
                        {!f.activo && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Inactivo</span>
                        )}
                        {f.requiere_receta && (
                          <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700" title="Requiere receta">Rx</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {f.codigo_barras ? <span className="font-mono">{f.codigo_barras}</span> : "Sin código"}
                        {f.presentacion && <span> · {f.presentacion}</span>}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{f.principio_activo ?? "—"}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${sinStock ? "font-bold text-rose-600" : "text-slate-900"}`}>
                    {f.stock_venta}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{f.stock_bodega}</td>
                  <td className="px-4 py-3">
                    {f.vence && sem ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sem.clases}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sem.dot}`} />
                        {fmtFecha(f.vence)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{fmt(f.precio_venta)}</td>
                  {esGestor && (
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {f.costo != null ? fmt(f.costo) : "—"}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {visibles.length} de {filas.length} productos · toca un producto para ver sus lotes, vencimientos y movimientos
      </p>

      {esGestor && (
        <ProductoFormDialog
          open={formAbierto}
          onOpenChange={setFormAbierto}
          producto={editando}
          proveedores={proveedores}
          laboratorios={laboratorios}
        />
      )}
    </div>
  )
}
