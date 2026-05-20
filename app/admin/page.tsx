import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, UserCheck, Clock } from "lucide-react"

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Obtener conteos
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })

  const { count: pendingUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_approved", false)

  const { count: activeMembers } = await supabase
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .gte("end_date", new Date().toISOString().split("T")[0])

  const { data: recentUsers } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  const stats = [
    {
      title: "Total de Usuarios",
      value: totalUsers || 0,
      description: "Cuentas registradas",
      icon: Users,
    },
    {
      title: "Pendientes de Aprobación",
      value: pendingUsers || 0,
      description: "Esperando revisión",
      icon: Clock,
    },
    {
      title: "Miembros Activos",
      value: activeMembers || 0,
      description: "Con membresía válida",
      icon: CreditCard,
    },
    {
      title: "Usuarios Aprobados",
      value: (totalUsers || 0) - (pendingUsers || 0),
      description: "Pueden acceder a la plataforma",
      icon: UserCheck,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
        <p className="text-muted-foreground">
          Resumen de las estadísticas de tu plataforma
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios Recientes</CardTitle>
          <CardDescription>Últimas cuentas registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentUsers?.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-medium text-primary">
                      {user.full_name
                        ? user.full_name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.full_name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      user.is_approved
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {user.is_approved ? "Aprobado" : "Pendiente"}
                  </span>
                </div>
              </div>
            ))}
            {(!recentUsers || recentUsers.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aún no hay usuarios
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
