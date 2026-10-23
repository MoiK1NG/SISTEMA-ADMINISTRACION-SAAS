import Link from "next/link"
import {
  Ban, AlertTriangle, CalendarOff, TrendingDown, HeartPulse, Receipt, CheckCircle2, ArrowRight,
} from "lucide-react"
import type { AlertasHoy } from "@/lib/farmacia/alertas"

interface Tarjeta {
  key:    keyof AlertasHoy
  label:  (n: number) => string
  accion: string
  href:   string
  icon:   React.ComponentType<{ className?: string }>
  tono:   string   // burbuja del ícono
}

const TARJETAS: Tarjeta[] = [
  { key: "vencidos",     label: n => n === 1 ? "producto vencido con stock" : "productos vencidos con stock",
    accion: "Retirar del estante", href: "/portal/farmacia/inventario?filtro=vencidos",
    icon: Ban, tono: "bg-slate-800 text-white" },
  { key: "por_vencer",   label: n => n === 1 ? "producto vence en 3 meses o menos" : "productos vencen en 3 meses o menos",
    accion: "Rotar o devolver al proveedor", href: "/portal/farmacia/inventario?filtro=por_vencer",
    icon: AlertTriangle, tono: "bg-rose-100 text-rose-700" },
  { key: "sin_fecha",    label: n => n === 1 ? "producto con lote sin fecha" : "productos con lotes sin fecha",
    accion: "Completar la fecha de vencimiento", href: "/portal/farmacia/inventario?filtro=sin_fecha",
    icon: CalendarOff, tono: "bg-slate-100 text-slate-600" },
  { key: "bajo_minimo",  label: n => n === 1 ? "producto bajo el stock mínimo" : "productos bajo el stock mínimo",
    accion: "Reponer con el proveedor", href: "/portal/farmacia/inventario?filtro=bajo_minimo",
    icon: TrendingDown, tono: "bg-amber-100 text-amber-700" },
  { key: "cronicos",     label: n => n === 1 ? "paciente crónico por quedarse sin medicamento" : "pacientes crónicos por quedarse sin medicamento",
    accion: "Avisarles", href: "/portal/farmacia/pacientes",
    icon: HeartPulse, tono: "bg-amber-100 text-amber-700" },
  { key: "cxp_vencidas", label: n => n === 1 ? "cuenta por pagar vencida" : "cuentas por pagar vencidas",
    accion: "Ver en Compras", href: "/portal/farmacia/compras",
    icon: Receipt, tono: "bg-rose-100 text-rose-700" },
]

/** Alertas del día en el inicio del portal: solo las que tienen algo que mostrar. */
export function AlertasHoy({ alertas, esGestor }: { alertas: AlertasHoy; esGestor: boolean }) {
  const activas = TARJETAS.filter(t => {
    const n = alertas[t.key]
    return typeof n === "number" && n > 0
  })

  if (activas.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Todo en orden</p>
          <p className="text-xs text-slate-500">
            Sin vencimientos, stock bajo ni pacientes por avisar{esGestor ? ", y sin cuentas vencidas" : ""}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {activas.map(t => {
        const n = alertas[t.key] as number
        return (
          <Link
            key={t.key}
            href={t.href}
            className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.tono}`}>
              <t.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-black leading-none tabular-nums text-slate-900">{n}</p>
              <p className="mt-1 text-xs font-medium text-slate-700">{t.label(n)}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-brand-700">
                {t.accion} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
