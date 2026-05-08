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

  // Get active membership
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

  // Get portal access
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

// @ts-ignore
  const accessiblePortals: any[] = (portalAccess || [])
    .map((pa: any) => pa.portals)
    .flat()
    .filter((p: any) => p && p.is_active);

  // Calculate days remaining
  const daysRemaining = activeMembership
    ? differenceInDays(new Date(activeMembership.end_date), new Date())
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground">
          {"Here's an overview of your account and available portals"}
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
            <h2 className="text-xl font-semibold mb-4">Your Portals</h2>
            <PortalsGrid portals={accessiblePortals || []} />
          </div>
        </>
      )}
    </div>
  )
}
