import { requireClient } from "@/lib/supabase/require-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CreditCard, ArrowRight } from "lucide-react"
import { MembershipsTable, type FilaMembresia } from "./_components/memberships-table"

export default async function MembershipsPage() {
  const supabase = await requireClient()
  const today = new Date().toISOString().split("T")[0]
  const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]

  const { data: memberships } = await supabase
    .from("memberships")
    .select(`id, start_date, end_date, status, user_id,
      profiles:user_id(full_name, email),
      membership_plans:plan_id(name, price, duration_days)`)
    .order("created_at", { ascending: false })

  const filas: FilaMembresia[] = (memberships ?? []).map((m: any) => {
    const perfil = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    const plan   = Array.isArray(m.membership_plans) ? m.membership_plans[0] : m.membership_plans
    return {
      id:         m.id,
      start_date: m.start_date,
      end_date:   m.end_date,
      status:     m.status,
      negocio:    perfil?.full_name || perfil?.email || "Sin nombre",
      email:      perfil?.email ?? "",
      plan:       plan?.name ?? "—",
      precio:     plan?.price != null ? Number(plan.price) : null,
    }
  })

  // Los totales se calculan sobre las filas ya traídas: una sola consulta y
  // números que siempre coinciden con lo que se ve en la tabla.
  const vigente  = (f: FilaMembresia) => f.status === "active" && f.end_date >= today
  const activas  = filas.filter(vigente).length
  const porVencer = filas.filter(f => vigente(f) && f.end_date <= en7dias).length
  const expiradas = filas.filter(f => f.end_date < today).length

  const stats = [
    { label: "Activas",          value: activas,     color: "text-emerald-600" },
    { label: "Vencen en 7 días", value: porVencer,   color: "text-amber-600"   },
    { label: "Expiradas",        value: expiradas,   color: "text-red-600"     },
    { label: "Total",            value: filas.length, color: "text-blue-600"   },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membresías</h1>
          <p className="text-sm text-muted-foreground">
            Extiende, suspende o revoca las suscripciones de tus clientes
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/plans">Gestionar planes <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-5 text-center">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Todas las membresías
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MembershipsTable filas={filas} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Para asignar una membresía nueva a un cliente, entra a{" "}
        <Link href="/admin/users" className="font-medium text-blue-600 hover:underline">Usuarios</Link>{" "}
        y usa el menú de la fila.
      </p>
    </div>
  )
}
