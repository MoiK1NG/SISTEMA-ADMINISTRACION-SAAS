import { requireClient } from "@/lib/supabase/require-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Users, CreditCard, UserCheck, Clock,
  TrendingUp, AlertTriangle, ArrowRight, Activity,
} from "lucide-react"

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}

function getInitials(name: string | null, email: string) {
  if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  return email[0].toUpperCase()
}

export default async function AdminDashboardPage() {
  const supabase = await requireClient()
  const today = new Date().toISOString().split("T")[0]
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]

  const [
    { count: totalUsers },
    { count: pendingUsers },
    { count: activeMembers },
    { data: mrrData },
    { data: recentUsers },
    { count: expiring7 },
    { count: expiring30 },
    { count: totalPortals },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_approved", false),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("is_active", true).gte("end_date", today),
    supabase.from("memberships").select("membership_plans(price)").eq("is_active", true).gte("end_date", today),
    supabase.from("profiles").select("id,full_name,email,role,is_approved,created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("is_active", true).gte("end_date", today).lte("end_date", in7days),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("is_active", true).gte("end_date", today).lte("end_date", in30days),
    supabase.from("portals").select("*", { count: "exact", head: true }).eq("is_active", true),
  ])

  const mrr = (mrrData || []).reduce((sum: number, m: any) => sum + (m.membership_plans?.price ?? 0), 0)

  const kpis = [
    { title: "Usuarios totales",      value: totalUsers ?? 0,  sub: "cuentas registradas",       icon: Users,     color: "text-blue-600",   bg: "bg-blue-50"    },
    { title: "Pendientes aprobación", value: pendingUsers ?? 0, sub: "esperando revisión",        icon: Clock,     color: "text-amber-600",  bg: "bg-amber-50"   },
    { title: "Miembros activos",      value: activeMembers ?? 0, sub: "con membresía válida",     icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Portales activos",      value: totalPortals ?? 0,  sub: "módulos en producción",    icon: Activity,  color: "text-purple-600",  bg: "bg-purple-50"  },
  ]

  const alerts = [
    ...(pendingUsers ?? 0) > 0 ? [{ type: "warning" as const, msg: `${pendingUsers} usuarios esperando aprobación`, href: "/admin/users" }] : [],
    ...(expiring7 ?? 0) > 0   ? [{ type: "danger"  as const, msg: `${expiring7} membresías vencen en 7 días`,       href: "/admin/alerts" }] : [],
    ...(expiring30 ?? 0) > 0  ? [{ type: "info"    as const, msg: `${expiring30} membresías vencen en 30 días`,      href: "/admin/alerts" }] : [],
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de Control</h1>
          <p className="text-sm text-muted-foreground">Resumen ejecutivo de la plataforma</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/stats">Ver estadísticas <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
        </Button>
      </div>

      {/* MRR hero card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ingresos mensuales recurrentes (MRR)</p>
                <p className="text-3xl font-black text-foreground">{fmt(mrr)}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{activeMembers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Suscripciones activas</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-2xl font-bold text-foreground">{totalUsers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Clientes totales</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.title}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg}`}>
                  <k.icon className={`h-5 w-5 ${k.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alertas activas</h2>
          {alerts.map((a, i) => (
            <Link key={i} href={a.href} className="flex items-center gap-3 rounded-xl border px-4 py-3 hover:bg-muted/50 transition-colors group">
              <AlertTriangle className={`h-4 w-4 shrink-0 ${a.type === "danger" ? "text-red-500" : a.type === "warning" ? "text-amber-500" : "text-blue-500"}`} />
              <p className="flex-1 text-sm">{a.msg}</p>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {/* Recent users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Usuarios recientes</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/users">Ver todos <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {(recentUsers || []).map((u: any) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {getInitials(u.full_name, u.email)}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">{u.full_name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                  <Badge variant={u.is_approved ? "default" : "secondary"} className="text-[10px]">
                    {u.is_approved ? "Aprobado" : "Pendiente"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
