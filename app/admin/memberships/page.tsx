import { requireClient } from "@/lib/supabase/require-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CreditCard, ArrowRight, CalendarDays, User } from "lucide-react"
import { differenceInDays } from "date-fns"

function statusBadge(isActive: boolean, endDate: string) {
  const days = differenceInDays(new Date(endDate), new Date())
  if (!isActive) return { label: "Inactiva",      variant: "secondary"    as const }
  if (days < 0)  return { label: "Expirada",      variant: "destructive"  as const }
  if (days <= 7) return { label: `${days}d — Vence pronto`, variant: "warning" as const }
  return           { label: "Activa",             variant: "default"      as const }
}

export default async function MembershipsPage() {
  const supabase = await requireClient()
  const today = new Date().toISOString().split("T")[0]

  const [
    { data: memberships },
    { count: activeCount },
    { count: expiringCount },
    { count: expiredCount },
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select(`id, start_date, end_date, is_active, created_at, user_id,
        profiles:user_id(full_name, email),
        membership_plans:plan_id(name, price, duration_days)`)
      .order("created_at", { ascending: false }),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("is_active", true).gte("end_date", today),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("is_active", true)
      .gte("end_date", today).lte("end_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]),
    supabase.from("memberships").select("*", { count: "exact", head: true }).lt("end_date", today),
  ])

  const stats = [
    { label: "Activas",         value: activeCount   ?? 0, color: "text-emerald-600" },
    { label: "Vencen en 7 días",value: expiringCount ?? 0, color: "text-amber-600"   },
    { label: "Expiradas",       value: expiredCount  ?? 0, color: "text-red-600"     },
    { label: "Total",           value: (memberships || []).length, color: "text-blue-600" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membresías</h1>
          <p className="text-sm text-muted-foreground">Gestión de suscripciones de usuarios</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/plans">Gestionar planes <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-5 text-center">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Todas las membresías
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Inicio</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vencimiento</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(memberships || []).map((m: any) => {
                  const { label, variant } = statusBadge(m.is_active, m.end_date)
                  const daysLeft = differenceInDays(new Date(m.end_date), new Date())
                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {(m.profiles?.full_name || m.profiles?.email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium leading-none">{m.profiles?.full_name || "—"}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{m.profiles?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{m.membership_plans?.name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(m.start_date).toLocaleDateString("es-DO")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(m.end_date).toLocaleDateString("es-DO")}
                          {daysLeft >= 0 && daysLeft <= 30 && (
                            <span className="text-[10px] text-amber-600 font-medium">({daysLeft}d)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={variant} className="text-[10px]">{label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {m.membership_plans?.price
                          ? new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(m.membership_plans.price)
                          : "—"}
                      </td>
                    </tr>
                  )
                })}
                {(memberships || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No hay membresías registradas aún
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
