import { CreditCard, Calendar, Clock, Zap } from "lucide-react"

interface MembershipPlan { name: string; duration_days: number; price: number }
interface Membership     { status: string; start_date: string; end_date: string; membership_plans?: MembershipPlan }
interface Props          { membership?: Membership; daysRemaining: number }

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso))
}

export function MembershipCard({ membership, daysRemaining }: Props) {
  if (!membership) return null

  const plan        = membership.membership_plans
  const totalDays   = plan?.duration_days || 30
  const elapsed     = Math.max(0, totalDays - daysRemaining)
  const pct         = Math.min(100, Math.round((elapsed / totalDays) * 100))
  const isLow       = daysRemaining <= 7
  const isCritical  = daysRemaining <= 2

  const barColor    = isCritical ? "#ef4444" : isLow ? "#f59e0b" : "#22c55e"

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      {/* Decoración suave */}
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-blue-50 blur-2xl" />

      <div className="relative z-10 space-y-5">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Membresía activa</p>
              <p className="text-lg font-bold text-slate-900 leading-tight">{plan?.name || "Plan de Acceso"}</p>
            </div>
          </div>
          <div className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold border ${
            isCritical ? "bg-rose-50 text-rose-700 border-rose-200"
            : isLow    ? "bg-amber-50 text-amber-700 border-amber-200"
            :            "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}>
            {isCritical ? "⚠ Por vencer" : isLow ? "Atención" : "Activa"}
          </div>
        </div>

        {/* Días restantes — protagonista */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Clock className="h-4 w-4" />
            <span>Días restantes</span>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-slate-900">{Math.max(0, daysRemaining)}</span>
            <span className="text-sm text-slate-400 ml-1">/ {totalDays} días</span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{pct}% transcurrido</span>
            <span>{Math.max(0, daysRemaining)} días por usar</span>
          </div>
        </div>

        {/* Detalles */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Inicio</p>
              <p className="text-xs font-semibold text-slate-700">{fmtDate(membership.start_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Vence</p>
              <p className={`text-xs font-semibold ${isCritical ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-700"}`}>
                {fmtDate(membership.end_date)}
              </p>
            </div>
          </div>
          {plan?.price != null && (
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Precio plan</p>
                <p className="text-xs font-semibold text-slate-700">{fmt(plan.price)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
