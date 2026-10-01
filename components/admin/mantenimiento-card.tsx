"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ejecutarMantenimientoAhora } from "@/app/admin/actions"

export interface AlertaNegocio {
  negocio_id: string
  negocio:    string
  lotes_vencidos:             number
  lotes_por_vencer:           number
  lotes_sin_fecha:            number
  cronicos_por_acabarse:      number
  cuentas_por_pagar_vencidas: number
}

export interface UltimoMantenimiento {
  ejecutado_at:        string
  origen:              "cron" | "manual" | "sql"
  membresias_vencidas: number
  alertas:             AlertaNegocio[]
}

const ORIGEN: Record<UltimoMantenimiento["origen"], string> = {
  cron: "tarea programada", manual: "a mano desde el panel", sql: "desde el SQL Editor",
}

const ALERTA_LABEL: [keyof AlertaNegocio, string][] = [
  ["lotes_vencidos",             "lotes vencidos con stock"],
  ["lotes_por_vencer",           "lotes por vencer (≤ 90 días)"],
  ["lotes_sin_fecha",            "lotes sin fecha"],
  ["cronicos_por_acabarse",      "crónicos por quedarse sin medicamento"],
  ["cuentas_por_pagar_vencidas", "cuentas por pagar vencidas"],
]

/**
 * Estado del mantenimiento diario. La tarea programada corre una vez por día;
 * si pasan más de 2 sin que corra, la base del plan gratuito se acerca a la
 * pausa por inactividad (7 días) y conviene revisar Vercel → Cron Jobs.
 */
export function MantenimientoCard({ ultimo, faltaMigracion }: { ultimo: UltimoMantenimiento | null; faltaMigracion: boolean }) {
  const router = useRouter()
  const [corriendo, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const horas = ultimo ? (Date.now() - new Date(ultimo.ejecutado_at).getTime()) / 3_600_000 : null
  const estado =
    faltaMigracion || horas === null ? "rojo"
    : horas <= 26 ? "verde"
    : horas <= 48 ? "ambar"
    : "rojo"

  const ESTADO = {
    verde: { icon: CheckCircle2,  color: "text-emerald-600", borde: "border-emerald-200", fondo: "bg-emerald-50/60" },
    ambar: { icon: AlertTriangle, color: "text-amber-600",   borde: "border-amber-200",   fondo: "bg-amber-50/60"   },
    rojo:  { icon: XCircle,       color: "text-rose-600",    borde: "border-rose-200",    fondo: "bg-rose-50/60"    },
  }[estado]

  const titulo =
    faltaMigracion ? "Mantenimiento diario sin instalar"
    : !ultimo      ? "El mantenimiento diario nunca corrió"
    : estado === "verde" ? "Mantenimiento diario al día"
    : estado === "ambar" ? "El mantenimiento diario no corrió ayer"
    : "El mantenimiento diario lleva más de 2 días sin correr"

  const detalle =
    faltaMigracion ? "Falta correr supabase/mantenimiento_diario.sql en Supabase."
    : !ultimo      ? "Revisa que CRON_SECRET y SUPABASE_SERVICE_ROLE_KEY estén cargadas en Vercel."
    : `Última ejecución: ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(ultimo.ejecutado_at))} (hora de Colombia), ${ORIGEN[ultimo.origen]}.` +
      (estado === "rojo" ? " Supabase pausa la base gratuita tras 7 días sin actividad: revisa Vercel → Cron Jobs." : "")

  function ejecutar() {
    setError(null)
    start(async () => {
      try { await ejecutarMantenimientoAhora(); router.refresh() }
      catch (e: any) { setError(e?.message ?? "No se pudo ejecutar") }
    })
  }

  const conAlertas = (ultimo?.alertas ?? []).filter(a => ALERTA_LABEL.some(([k]) => Number(a[k]) > 0))

  return (
    <Card className={`${ESTADO.borde} ${ESTADO.fondo}`}>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <ESTADO.icon className={`mt-0.5 h-5 w-5 shrink-0 ${ESTADO.color}`} />
            <div>
              <p className="text-sm font-semibold text-slate-900">{titulo}</p>
              <p className="mt-0.5 text-xs text-slate-600">{detalle}</p>
              {ultimo && ultimo.membresias_vencidas > 0 && (
                <p className="mt-1 text-xs text-slate-600">
                  Marcó {ultimo.membresias_vencidas} membresía{ultimo.membresias_vencidas === 1 ? "" : "s"} como vencida{ultimo.membresias_vencidas === 1 ? "" : "s"}.
                </p>
              )}
            </div>
          </div>
          {!faltaMigracion && (
            <Button size="sm" variant="outline" onClick={ejecutar} disabled={corriendo} className="shrink-0 gap-1.5 bg-white">
              {corriendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Ejecutar ahora
            </Button>
          )}
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

        {conAlertas.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {conAlertas.map(a => (
              <div key={a.negocio_id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold text-slate-900">{a.negocio}</p>
                <ul className="mt-1 space-y-0.5">
                  {ALERTA_LABEL.filter(([k]) => Number(a[k]) > 0).map(([k, label]) => (
                    <li key={k} className="text-xs text-slate-600">
                      <span className="font-bold tabular-nums text-slate-900">{Number(a[k])}</span> {label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
