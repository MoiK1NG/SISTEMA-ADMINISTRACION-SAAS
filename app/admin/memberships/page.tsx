import { createClient } from "@/lib/supabase/server"
import { format, isPast } from "date-fns"
import { es } from "date-fns/locale"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function MembershipsPage() {
const supabase = await createClient()
  if (!supabase) throw new Error("No se pudo conectar a la base de datos")

  // Llamada limpia a la tabla de membresías
  const { data: memberships } = await supabase
    .from("memberships")
    .select(`
      *,
      profiles:user_id (
        full_name,
        email
      )
    `)
    .order("created_at", { ascending: false })

// Obtener conteos
const { count: totalUsers } = await supabase

const { data: memberships } = await supabase
  .from("memberships")
    .select(`
      *,
      profiles (
        id,
        full_name,
        email
      ),
      membership_plans (
        id,
        name,
        duration_days,
        price
      )
    `)
    .order("created_at", { ascending: false })

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("*")
    .order("duration_days", { ascending: true })

  const getMembershipStatus = (membership: any) => {
    if (!membership.is_active) {
      return { label: "Inactiva", variant: "secondary" as const }
    }
    if (isPast(new Date(membership.end_date))) {
      return { label: "Expirada", variant: "destructive" as const }
    }
    return { label: "Activa", variant: "success" as const }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Membresías</h1>
        <p className="text-muted-foreground">
          Ver y gestionar todas las suscripciones de membresía
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans?.map((plan) => {
          const activeMemberships = memberships?.filter(
            (m) => m.plan_id === plan.id && m.is_active && !isPast(new Date(m.end_date))
          ).length || 0

          return (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{plan.name}</CardTitle>
                <CardDescription>{plan.duration_days} días</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeMemberships}</div>
                <p className="text-xs text-muted-foreground">
                  suscripciones activas
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas las Membresías</CardTitle>
          <CardDescription>Lista completa de registros de membresía</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Fecha de Inicio</TableHead>
                <TableHead>Fecha de Fin</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships?.map((membership) => {
                const status = getMembershipStatus(membership)
                return (
                  <TableRow key={membership.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {membership.profiles?.full_name || "Sin nombre"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {membership.profiles?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{membership.membership_plans?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ${membership.membership_plans?.price}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(membership.start_date), "d MMM, yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(membership.end_date), "d MMM, yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {(!memberships || memberships.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No se encontraron membresías
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
