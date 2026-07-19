"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { actualizarProducido, actualizarEstadoOrden } from "../../actions"

interface ItemProduccion {
  id: string
  cantidad_plan: number
  cantidad_real: number | null
  productos_pan: { nombre: string } | null
}

interface OrdenProduccion {
  id: string
  fecha: string
  estado: string
  notas: string | null
  items_produccion: ItemProduccion[]
}

const ESTADO_CONFIG: Record<string, { label: string; icon: any; classes: string }> = {
  pendiente:   { label: "Pendiente",  icon: Clock,        classes: "bg-amber-50  text-amber-700  border-amber-200"  },
  en_proceso:  { label: "En proceso", icon: Loader2,      classes: "bg-blue-50   text-blue-700   border-blue-200"   },
  completada:  { label: "Completada", icon: CheckCircle2, classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada:   { label: "Cancelada",  icon: XCircle,      classes: "bg-slate-100 text-slate-500  border-slate-200"  },
}

const NEXT_ESTADO: Record<string, string | null> = {
  pendiente:  "en_proceso",
  en_proceso: "completada",
  completada: null,
  cancelada:  null,
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-DO", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(iso + "T00:00:00"))
}

export function OrdenProduccionCard({ orden }: { orden: OrdenProduccion }) {
  const router = useRouter()
  const [expanded, setExpanded]   = useState(false)
  const [isPending, start]        = useTransition()
  const [editId, setEditId]       = useState<string | null>(null)
  const [editVal, setEditVal]     = useState<number>(0)
  const cfg  = ESTADO_CONFIG[orden.estado] ?? ESTADO_CONFIG.pendiente
  const Icon = cfg.icon
  const nextEstado = NEXT_ESTADO[orden.estado]

  const total     = orden.items_produccion.length
  const completed = orden.items_produccion.filter(i => (i.cantidad_real ?? 0) >= i.cantidad_plan).length
  const progress  = total > 0 ? Math.round((completed / total) * 100) : 0

  function handleEstado() {
    if (!nextEstado) return
    start(async () => {
      await actualizarEstadoOrden(orden.id, nextEstado)
      router.refresh()
    })
  }

  function handleProducido(itemId: string, cantidad: number) {
    start(async () => {
      await actualizarProducido(itemId, cantidad)
      setEditId(null)
      router.refresh()
    })
  }

  return (
    <Card className="border-slate-100 bg-white shadow-sm overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <p className="text-sm font-semibold text-slate-900 capitalize">{fmtDate(orden.fecha)}</p>
              <p className="text-[11px] text-slate-400">{total} productos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cfg.classes}`}>
              <Icon className="h-3 w-3" />{cfg.label}
            </span>
            <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-50">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>{completed}/{total} completados</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-5 pb-5 space-y-3">
          {orden.notas && <p className="text-xs text-slate-500 italic">{orden.notas}</p>}
          <div className="space-y-2">
            {orden.items_produccion.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-800">{item.productos_pan?.nombre ?? "—"}</p>
                <div className="flex items-center gap-2 text-sm">
                  {editId === item.id ? (
                    <>
                      <input
                        type="number" min="0" max={item.cantidad_plan * 2}
                        value={editVal} onChange={e => setEditVal(Number(e.target.value))}
                        className="w-16 rounded border border-orange-300 px-2 py-0.5 text-center text-sm"
                        autoFocus
                      />
                      <button onClick={() => handleProducido(item.id, editVal)} disabled={isPending}
                        className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700">Guardar</button>
                      <button onClick={() => setEditId(null)} className="text-[11px] text-slate-400 hover:text-slate-600">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-500">
                        <span className="font-semibold text-slate-900">{item.cantidad_real ?? 0}</span>/{item.cantidad_plan}
                      </span>
                      {orden.estado !== "completada" && orden.estado !== "cancelada" && (
                        <button onClick={() => { setEditId(item.id); setEditVal(item.cantidad_real ?? 0) }}
                          className="text-[11px] font-medium text-orange-500 hover:text-orange-700 border border-orange-200 rounded px-2 py-0.5">
                          Editar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {nextEstado && (
            <div className="pt-2 flex justify-end">
              <button onClick={handleEstado} disabled={isPending}
                className="text-sm font-medium text-orange-600 border border-orange-200 rounded-lg px-4 py-1.5 hover:bg-orange-50 transition-colors disabled:opacity-50">
                {isPending ? "Actualizando…" : nextEstado === "en_proceso" ? "▶ Iniciar producción" : "✓ Completar orden"}
              </button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
