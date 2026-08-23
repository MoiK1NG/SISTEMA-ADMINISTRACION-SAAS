import { requireClient } from "@/lib/supabase/require-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Layers, Users, DollarSign, Clock } from "lucide-react"
import { PlansManager } from "./_components/plans-manager"

export default async function PlansPage() {
  const supabase = await requireClient()
  const today = new Date().toISOString().split("T")[0]

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("*")
    .order("price", { ascending: true })

  const { data: activeSubs } = await supabase
    .from("memberships")
    .select("plan_id")
    .eq("is_active", true)
    .gte("end_date", today)

  const subsByPlan = (activeSubs || []).reduce<Record<string, number>>((acc, m: any) => {
    acc[m.plan_id] = (acc[m.plan_id] ?? 0) + 1
    return acc
  }, {})

  const plansWithCount = (plans || []).map((p: any) => ({
    ...p,
    activeCount: subsByPlan[p.id] ?? 0,
  }))

  const totalMRR = plansWithCount.reduce((sum, p) => sum + p.price * p.activeCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planes de membresía</h1>
          <p className="text-sm text-muted-foreground">Configura los planes disponibles para tus clientes</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
              <Layers className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{(plans || []).length}</p>
              <p className="text-xs text-muted-foreground">Planes configurados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{Object.values(subsByPlan).reduce((a, b) => a + b, 0)}</p>
              <p className="text-xs text-muted-foreground">Suscripciones activas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(totalMRR)}
              </p>
              <p className="text-xs text-muted-foreground">MRR de estos planes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans manager (client component for create/edit/delete) */}
      <PlansManager plans={plansWithCount} />
    </div>
  )
}
