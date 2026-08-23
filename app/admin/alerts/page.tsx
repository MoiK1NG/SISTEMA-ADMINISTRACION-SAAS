import { requireClient } from "@/lib/supabase/require-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertTriangle, Clock, UserX, Bell, CheckCircle2, ArrowRight } from "lucide-react"
import { differenceInDays } from "date-fns"

export default async function AlertsPage() {
  const supabase = await requireClient()
  const today = new Date().toISOString().split("T")[0]
  const in7  = new Date(Date.now() + 7  * 86400000).toISOString().split("T")[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]

  const [
    { data: expiringCritical },
    { data: expiringWarning },
    { data: pendingUsers },
    { data: inactiveUsers },
  ] = await Promise.all([
    // Vencen en 7 días
    supabase
      .from("memberships")
      .select(`end_date, profiles:user_id(full_name, email), membership_plans:plan_id(name)`)
      .eq("is_active", true).gte("end_date", today).lte("end_date", in7)
      .order("end_date", { ascending: true }),
    // Vencen en 8-30 días
    supabase
      .from("memberships")
      .select(`end_date, profiles:user_id(full_name, email), membership_plans:plan_id(name)`)
      .eq("is_active", true).gt("end_date", in7).lte("end_date", in30)
      .order("end_date", { ascending: true }),
    // Pendientes de aprobación
    supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("is_approved", false)
      .order("created_at", { ascending: false }),
    // Usuarios suspendidos
    supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("is_active", false).eq("is_approved", true)
      .order("created_at", { ascending: false }),
  ])

  const fmt = (date: string) => new Date(date).toLocaleDateString("es-CO", { day: "numeric", month: "short" })
  const totalAlerts = (expiringCritical?.length ?? 0) + (expiringWarning?.length ?? 0) + (pendingUsers?.length ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" /> Centro de alertas
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalAlerts > 0 ? `${totalAlerts} alertas requieren atención` : "Todo en orden — sin alertas críticas"}
          </p>
        </div>
      </div>

      {totalAlerts === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
            <p className="font-semibold text-lg">Sin alertas activas</p>
            <p className="text-sm text-muted-foreground mt-1">Todas las membresías están en buen estado y no hay aprobaciones pendientes</p>
          </CardContent>
        </Card>
      )}

      {/* Crítico: vencen en 7 días */}
      {(expiringCritical?.length ?? 0) > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Vencimiento crítico — próximos 7 días
              <Badge variant="destructive" className="ml-auto">{expiringCritical!.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {expiringCritical!.map((m: any, i: number) => {
              const days = differenceInDays(new Date(m.end_date), new Date())
              return (
                <div key={i} className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-red-900">{m.profiles?.full_name || m.profiles?.email}</p>
                    <p className="text-xs text-red-600">{m.profiles?.email} · {m.membership_plans?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-700">{fmt(m.end_date)}</p>
                    <p className="text-xs text-red-500">{days === 0 ? "Hoy" : `en ${days} día${days !== 1 ? "s" : ""}`}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Advertencia: vencen en 8-30 días */}
      {(expiringWarning?.length ?? 0) > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              Próximos vencimientos — 8 a 30 días
              <Badge variant="warning" className="ml-auto">{expiringWarning!.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {expiringWarning!.map((m: any, i: number) => {
              const days = differenceInDays(new Date(m.end_date), new Date())
              return (
                <div key={i} className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{m.profiles?.full_name || m.profiles?.email}</p>
                    <p className="text-xs text-amber-600">{m.profiles?.email} · {m.membership_plans?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-700">{fmt(m.end_date)}</p>
                    <p className="text-xs text-amber-500">en {days} días</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Aprobaciones pendientes */}
      {(pendingUsers?.length ?? 0) > 0 && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-blue-600">
              <UserX className="h-4 w-4" />
              Aprobaciones pendientes
              <Badge className="ml-auto">{pendingUsers!.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {pendingUsers!.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-blue-900">{u.full_name || "Sin nombre"}</p>
                  <p className="text-xs text-blue-600">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-blue-500">{new Date(u.created_at).toLocaleDateString("es-CO")}</p>
                  <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                    <Link href="/admin/users">Revisar <ArrowRight className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Suspendidos */}
      {(inactiveUsers?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <UserX className="h-4 w-4" />
              Usuarios suspendidos
              <Badge variant="secondary" className="ml-auto">{inactiveUsers!.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {inactiveUsers!.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{u.full_name || "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <Link href="/admin/users">Gestionar</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
