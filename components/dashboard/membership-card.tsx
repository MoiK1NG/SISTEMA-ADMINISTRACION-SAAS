import { CreditCard, Calendar, Clock, Zap } from "lucide-react"

interface MembershipPlan { name: string; duration_days: number; price: number }
interface Membership     { status: string; start_date: string; end_date: string; membership_plans?: MembershipPlan }
interface Props          { membership?: Membership; daysRemaining: number }

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso))
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
    <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#1d4ed8] p-6 text-white shadow-md shadow-blue-900/20">
      {/* Decoración */}
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-blue-400/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 h-32 w-64 rounded-full bg-indigo-600/10 blur-3xl" />

      <div className="relative z-10 space-y-5">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/15">
              <CreditCard className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-200/70 uppercase tracking-wider">Membresía activa</p>
              <p className="text-lg font-bold text-white leading-tight">{plan?.name || "Plan de Acceso"}</p>
            </div>
          </div>
          <div className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
            isCritical ? "bg-red-500/20 text-red-200 border border-red-400/30"
            : isLow    ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
            :            "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
          }`}>
            {isCritical ? "⚠ Por vencer" : isLow ? "Atención" : "Activa"}
          </div>
        </div>

        {/* Días restantes — protagonista */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-100/70 text-sm">
            <Clock className="h-4 w-4" />
            <span>Días restantes</span>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-white">{Math.max(0, daysRemaining)}</span>
            <span className="text-sm text-blue-200/60 ml-1">/ {totalDays} días</span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-blue-200/50">
            <span>{pct}% transcurrido</span>
            <span>{Math.max(0, daysRemaining)} días por usar</span>
          </div>
        </div>

        {/* Detalles */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-blue-300/60 shrink-0" />
            <div>
              <p className="text-[10px] text-blue-200/50 uppercase tracking-wide">Inicio</p>
              <p className="text-xs font-semibold text-blue-100">{fmtDate(membership.start_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-blue-300/60 shrink-0" />
            <div>
              <p className="text-[10px] text-blue-200/50 uppercase tracking-wide">Vence</p>
              <p className={`text-xs font-semibold ${isCritical ? "text-red-300" : isLow ? "text-amber-300" : "text-blue-100"}`}>
                {fmtDate(membership.end_date)}
              </p>
            </div>
          </div>
          {plan?.price != null && (
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-blue-300/60 shrink-0" />
              <div>
                <p className="text-[10px] text-blue-200/50 uppercase tracking-wide">Precio plan</p>
                <p className="text-xs font-semibold text-blue-100">{fmt(plan.price)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
