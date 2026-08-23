import { requireClient } from "@/lib/supabase/require-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, Grid3X3, CreditCard, Activity } from "lucide-react"

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}

export default async function StatsPage() {
  const supabase = await requireClient()
  const today = new Date().toISOString().split("T")[0]

  // Last 6 months labels
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return { label: d.toLocaleDateString("es-CO", { month: "short" }), year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const [
    { data: allMemberships },
    { data: planRevenue },
    { data: portalAccess },
    { data: portals },
    { count: totalUsers },
    { count: approvedUsers },
  ] = await Promise.all([
    supabase.from("memberships").select("created_at, is_active, end_date"),
    supabase.from("memberships").select("membership_plans:plan_id(name, price)").eq("is_active", true).gte("end_date", today),
    supabase.from("user_portal_access").select("portal_id, portals:portal_id(name)"),
    supabase.from("portals").select("id, name, is_active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_approved", true),
  ])

  // Revenue by plan
  const revenueByPlan = (planRevenue || []).reduce<Record<string, { name: string; count: number; revenue: number }>>((acc, m: any) => {
    const name = m.membership_plans?.name ?? "Sin plan"
    const price = m.membership_plans?.price ?? 0
    if (!acc[name]) acc[name] = { name, count: 0, revenue: 0 }
    acc[name].count++
    acc[name].revenue += price
    return acc
  }, {})

  const planStats = Object.values(revenueByPlan).sort((a, b) => b.revenue - a.revenue)
  const totalMRR = planStats.reduce((s, p) => s + p.revenue, 0)

  // Portal usage
  const portalUsage = (portalAccess || []).reduce<Record<string, { name: string; count: number }>>((acc, pa: any) => {
    const id = pa.portal_id
    const name = pa.portals?.name ?? "Desconocido"
    if (!acc[id]) acc[id] = { name, count: 0 }
    acc[id].count++
    return acc
  }, {})
  const portalStats = Object.values(portalUsage).sort((a, b) => b.count - a.count)
  const maxPortalCount = Math.max(...portalStats.map(p => p.count), 1)

  // New users per month (last 6 months)
  const usersByMonth = months.map(m => ({
    ...m,
    count: (allMemberships || []).filter(mem => {
      const d = new Date(mem.created_at)
      return d.getFullYear() === m.year && d.getMonth() + 1 === m.month
    }).length
  }))
  const maxUsers = Math.max(...usersByMonth.map(m => m.count), 1)

  const approvalRate = totalUsers ? Math.round(((approvedUsers ?? 0) / totalUsers) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">Vista ejecutiva del rendimiento de la plataforma</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "MRR total",       value: fmt(totalMRR),          icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Usuarios totales",value: String(totalUsers ?? 0), icon: Users,      color: "text-blue-600",   bg: "bg-blue-50"    },
          { label: "Tasa aprobación", value: `${approvalRate}%`,      icon: Activity,   color: "text-purple-600", bg: "bg-purple-50"  },
          { label: "Portales activos",value: String((portals || []).filter((p: any) => p.is_active).length), icon: Grid3X3, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-5 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg}`}>
                <k.icon className={`h-5 w-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xl font-black">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Ingresos por plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {planStats.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin datos de planes activos</p>}
            {planStats.map(p => {
              const pct = totalMRR > 0 ? Math.round((p.revenue / totalMRR) * 100) : 0
              return (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{p.count} usuarios</Badge>
                      <span className="font-bold text-emerald-600">{fmt(p.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Portal usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" /> Uso de portales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {portalStats.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin accesos asignados aún</p>}
            {portalStats.map(p => {
              const pct = Math.round((p.count / maxPortalCount) * 100)
              return (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.count} usuarios</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* New memberships per month */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Nuevas membresías — últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-32">
            {usersByMonth.map(m => {
              const heightPct = maxUsers > 0 ? (m.count / maxUsers) * 100 : 0
              return (
                <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">{m.count > 0 ? m.count : ""}</span>
                  <div className="w-full rounded-t-md bg-blue-500/20 relative overflow-hidden" style={{ height: "80px" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-md bg-blue-500 transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{m.label}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
