import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { differenceInDays, isPast } from "date-fns"
import { MembershipCard } from "@/components/dashboard/membership-card"
import { PortalsGrid } from "@/components/dashboard/portals-grid"
import { AccessExpiredCard } from "@/components/dashboard/access-expired-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Shield, Clock } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Añadimos el paracaídas de seguridad para calmar a TypeScript
  if (!supabase) {
    throw new Error("No se pudo conectar a la base de datos de Supabase.")
  }

  // 2. Usamos la aserción de no nulo con "supabase!" para asegurar la llamada
  const { data: { user } } = await supabase!.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase!
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // Obtener membresía activa
  const { data: memberships } = await supabase!
    .from("memberships")
    .select(`
      *,
      membership_plans (
        id,
        name,
        description,
        duration_days,
        price
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("end_date", { ascending: false })
    .limit(1)

  const activeMembership = memberships?.[0]
  const hasValidMembership = activeMembership && !isPast(new Date(activeMembership.end_date))

  // Obtener acceso a portales con todos los campos
  const { data: portalAccess } = await supabase!
    .from("user_portal_access")
    .select(`
      id,
      portal_id,
      portals (
        id,
        name,
        slug,
        description,
        url,
        icon,
        color,
        is_active
      )
    `)
    .eq("user_id", user.id)

  // Extraer los portales activos
  const accessiblePortals = (portalAccess || [])
    .map((pa: any) => pa.portals)
    .filter((p: any) => p !== null && p !== undefined && p.is_active)

  // Calcular días restantes
  const daysRemaining = activeMembership
    ? differenceInDays(new Date(activeMembership.end_date), new Date())
    : 0

  // Obtener hora para el saludo
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"

  return (
    <div className="space-y-8">
      {/* Header con saludo */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting}{profile?.full_name ? `, {profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Aquí tienes un resumen de tu cuenta y portales disponibles
          </p>
        </div>
        
        {hasValidMembership && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
              <Shield className="h-3.5 w-3.5" />
              {profile?.role === "superadmin" ? "Super Admin" : profile?.role === "admin" ? "Admin" : "Usuario"}
            </Badge>
          </div>
        )}
      </div>

      {!hasValidMembership ? (
        <AccessExpiredCard />
      ) : (
        <>
          {/* Estadísticas rápidas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{accessiblePortals.length}</p>
                    <p className="text-sm text-muted-foreground">Portales Activos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                    <Clock className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {daysRemaining > 0 ? daysRemaining : 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Días Restantes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan Actual</p>
                    <p className="text-xl font-semibold">
                      {activeMembership?.membership_plans?.name || "Sin Plan"}
                    </p>
                  </div>
                  <Badge 
                    variant={daysRemaining > 7 ? "success" : daysRemaining > 0 ? "warning" : "destructive"}
                    className="text-sm"
                  >
                    {daysRemaining > 7 ? "Activo" : daysRemaining > 0 ? "Por Expirar" : "Expirado"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tarjeta de membresía */}
          <MembershipCard
            membership={activeMembership}
            daysRemaining={daysRemaining}
          />

          {/* Grid de portales */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Tus Portales</h2>
                <p className="text-sm text-muted-foreground">
                  Accede a tus herramientas empresariales
                </p>
              </div>
            </div>
            <PortalsGrid portals={(accessiblePortals || []) as any} />
          </div>
        </>
      )}
    </div>
  )
}
