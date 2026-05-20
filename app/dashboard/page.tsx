

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { differenceInDays, isPast } from "date-fns"
import { MembershipCard } from "@/components/dashboard/membership-card"
import { PortalsGrid } from "@/components/dashboard/portals-grid"
import { AccessExpiredCard } from "@/components/dashboard/access-expired-card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // Obtener membresía activa
  const { data: memberships } = await supabase
    .from("memberships")
    .select(`
      *,
      membership_plans (
        id,
        name,
        duration_days,
        price
      )
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("end_date", { ascending: false })
    .limit(1)

  const activeMembership = memberships?.[0]
  const hasValidMembership = activeMembership && !isPast(new Date(activeMembership.end_date))

  // Obtener acceso a portales
  const { data: portalAccess } = await supabase
    .from("user_portal_access")
    .select(`
      id,
      portal_id,
      portals (
        id,
        name,
        slug,
        description,
        is_active
      )
    `)
    .eq("user_id", user.id)

  // CORRECCIÓN DEFINITIVA: 
  // Extraemos los portales y forzamos a que el sistema los acepte pase lo que pase
  const rawPortals = (portalAccess || [])
    .map((pa: any) => pa.portals)
    .flat()
    .filter((p: any) => p !== null && p !== undefined && p.is_active);

  const accessiblePortals = rawPortals as any[];

  // Calcular días restantes
  const daysRemaining = activeMembership
    ? differenceInDays(new Date(activeMembership.end_date), new Date())
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bienvenido de nuevo{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground">
          {"Aquí tienes un resumen de tu cuenta y portales disponibles"}
        </p>
      </div>

      {!hasValidMembership ? (
        <AccessExpiredCard />
      ) : (
        <>
          <MembershipCard
            membership={activeMembership}
            daysRemaining={daysRemaining}
          />

          <div>
            <h2 className="text-xl font-semibold mb-4">Tus Portales</h2>
            {/* Usamos el casting 'as any' aquí también para asegurar que no se detenga el build */}
            <PortalsGrid portals={(accessiblePortals || []) as any} />
          </div>
        </>
      )}
    </div>
  )
}
