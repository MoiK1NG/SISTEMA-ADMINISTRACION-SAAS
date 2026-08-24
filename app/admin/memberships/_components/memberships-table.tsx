"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  MoreHorizontal, CalendarPlus, Ban, Trash2, PlayCircle, Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  extendMembership, updateMembershipStatus, deleteMembership,
} from "@/app/admin/actions"

export interface FilaMembresia {
  id:         string
  start_date: string
  end_date:   string
  status:     string
  negocio:    string
  email:      string
  plan:       string
  precio:     number | null
}

const fmtMoneda = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

const fmtFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso + "T00:00:00"))

function diasRestantes(end: string) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fin = new Date(end + "T00:00:00")
  return Math.round((fin.getTime() - hoy.getTime()) / 86_400_000)
}

function estadoVisual(m: FilaMembresia) {
  if (m.status === "cancelled") return { label: "Cancelada",  clases: "bg-slate-100 text-slate-600 border-slate-200" }
  if (m.status === "suspended") return { label: "Suspendida", clases: "bg-amber-50 text-amber-700 border-amber-200"  }
  const d = diasRestantes(m.end_date)
  if (m.status !== "active" || d < 0) return { label: "Expirada", clases: "bg-rose-50 text-rose-700 border-rose-200" }
  if (d <= 7) return { label: d + "d restantes", clases: "bg-amber-50 text-amber-700 border-amber-200" }
  return { label: d + "d restantes", clases: "bg-emerald-50 text-emerald-700 border-emerald-200" }
}

const EXTENSIONES = [
  { dias: 30,  label: "30 días" },
  { dias: 90,  label: "90 días" },
  { dias: 365, label: "1 año"   },
]

export function MembershipsTable({ filas }: { filas: FilaMembresia[] }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState("")
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const visibles = filas.filter(f => {
    const q = busqueda.toLowerCase()
    return !q
      || f.negocio.toLowerCase().includes(q)
      || f.email.toLowerCase().includes(q)
      || f.plan.toLowerCase().includes(q)
  })

  function correr(fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      try { await fn(); router.refresh() }
      catch (e: any) { setError(e?.message ?? "No se pudo completar la acción") }
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      )}

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar negocio, correo o plan…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="h-10 rounded-xl pl-9"
        />
      </div>

      <div className={`overflow-x-auto rounded-xl border border-slate-100 bg-white transition-opacity ${isPending ? "opacity-60" : ""}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Negocio</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Plan</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Inicio</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Vencimiento</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Precio</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="py-14 text-center text-sm text-slate-400">
                  {filas.length === 0
                    ? "No hay membresías registradas aún"
                    : "Sin resultados para esa búsqueda"}
                </td>
              </tr>
            )}

            {visibles.map(m => {
              const est = estadoVisual(m)
              return (
                <tr key={m.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{m.negocio}</p>
                    <p className="text-xs text-slate-400">{m.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{m.plan}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtFecha(m.start_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{fmtFecha(m.end_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${est.clases}`}>
                      {est.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                    {m.precio != null ? fmtMoneda(m.precio) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel className="text-xs font-normal text-slate-400">
                          Extender vigencia
                        </DropdownMenuLabel>
                        {EXTENSIONES.map(e => (
                          <DropdownMenuItem
                            key={e.dias}
                            className="cursor-pointer gap-2 text-sm"
                            onClick={() => correr(() => extendMembership(m.id, e.dias))}
                          >
                            <CalendarPlus className="h-4 w-4 text-slate-400" />
                            {e.label}
                          </DropdownMenuItem>
                        ))}

                        <DropdownMenuSeparator />

                        {m.status === "active" ? (
                          <>
                            <DropdownMenuItem
                              className="cursor-pointer gap-2 text-sm"
                              onClick={() => correr(() => updateMembershipStatus(m.id, "suspended"))}
                            >
                              <Ban className="h-4 w-4 text-amber-500" />
                              Suspender
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer gap-2 text-sm text-rose-600 focus:text-rose-700"
                              onClick={() => correr(() => updateMembershipStatus(m.id, "cancelled"))}
                            >
                              <Ban className="h-4 w-4" />
                              Revocar acceso
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 text-sm"
                            onClick={() => correr(() => updateMembershipStatus(m.id, "active"))}
                          >
                            <PlayCircle className="h-4 w-4 text-emerald-500" />
                            Reactivar
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-sm text-rose-600 focus:text-rose-700"
                          onClick={() => {
                            const ok = confirm(
                              "Se elimina el registro de la membresía de " + m.negocio +
                              ". Para quitarle el acceso sin perder el historial, conviene revocarla."
                            )
                            if (ok) correr(() => deleteMembership(m.id))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar registro
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
