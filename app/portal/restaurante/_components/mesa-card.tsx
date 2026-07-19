"use client"

import Link from "next/link"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Users, UtensilsCrossed, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { abrirOrden } from "../actions"

interface Mesa {
  id: string
  numero: number
  capacidad: number
  estado: string
}

interface OrdenAbierta {
  id: string
  total: number
  created_at: string
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)
}

const ESTADO_MESA: Record<string, { label: string; bg: string; border: string; dot: string }> = {
  libre:     { label: "Libre",     bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  ocupada:   { label: "Ocupada",   bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500"     },
  reservada: { label: "Reservada", bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500"   },
  cerrada:   { label: "Cerrada",   bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-400"   },
}

export function MesaCard({ mesa, ordenAbierta }: { mesa: Mesa; ordenAbierta: OrdenAbierta | null }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const cfg = ESTADO_MESA[mesa.estado] ?? ESTADO_MESA.libre

  async function handleAbrirOrden() {
    start(async () => {
      const { orden_id } = await abrirOrden(mesa.id)
      router.push(`/portal/restaurante/orden/${orden_id}`)
    })
  }

  return (
    <div className={`group relative flex flex-col rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-5 shadow-sm hover:shadow-md transition-all`}>
      {/* Estado badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Users className="h-3 w-3" />{mesa.capacidad}
        </div>
      </div>

      {/* Número */}
      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100">
          <UtensilsCrossed className="h-5 w-5 text-slate-400" />
        </div>
        <p className="mt-2 text-xl font-bold text-slate-900">Mesa {mesa.numero}</p>
        {ordenAbierta && (
          <p className="mt-1 text-sm font-semibold text-red-600">{fmt(Number(ordenAbierta.total))}</p>
        )}
      </div>

      {/* Acción */}
      <div className="mt-3">
        {mesa.estado === "libre" ? (
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-sm"
            size="sm"
            onClick={handleAbrirOrden}
            disabled={isPending}
          >
            {isPending ? "Abriendo…" : "Abrir mesa"}
          </Button>
        ) : mesa.estado === "ocupada" && ordenAbierta ? (
          <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-sm" size="sm">
            <Link href={`/portal/restaurante/orden/${ordenAbierta.id}`}>
              <Receipt className="h-3.5 w-3.5 mr-1.5" />Ver orden
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full text-sm" disabled>
            {cfg.label}
          </Button>
        )}
      </div>
    </div>
  )
}
