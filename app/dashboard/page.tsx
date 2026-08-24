import { differenceInDays, isPast } from "date-fns"
import { Suspense } from "react"
import { MembershipCard } from "@/components/dashboard/membership-card"
import { PortalsGrid } from "@/components/dashboard/portals-grid"
import { AccessExpiredCard } from "@/components/dashboard/access-expired-card"
import { PortalAccessAlert } from "@/components/dashboard/portal-access-alert"
import { Shield, Grid3X3, CalendarDays, Layers } from "lucide-react"
import { resolverAgente } from "@/lib/admin-context"
import { BannerVerComo } from "@/components/portal/banner-ver-como"

export default async function DashboardPage() {
  // Si un admin activó "ver como cliente", el dashboard lista los portales
  // y la membresía de ese cliente, no los propios.
  const { supabase, agenteId, viendoA } = await resolverAgente()

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", agenteId).single()

  const { data: memberships } = await supabase
    .from("memberships")
    .select("*, membership_plans(id, name, description, duration_days, price)")
    .eq("user_id", agenteId).eq("is_active", true)
    .order("end_date", { ascending: false }).limit(1)

  const activeMembership  = memberships?.[0]
  const isSuperAdmin      = profile?.role === "superadmin"
  const hasValidMembership = isSuperAdmin || (activeMembership && !isPast(new Date(activeMembership.end_date)))

  let accessiblePortals: any[] = []
  if (isSuperAdmin) {
    const { data: allPortals } = await supabase
      .from("portals")
      .select("id, name, slug, description, url, icon, color, is_active, created_at, updated_at")
      .eq("is_active", true).order("name")
    accessiblePortals = allPortals ?? []
  } else {
    const { data: portalAccess } = await supabase
      .from("user_portal_access")
      .select("id, portal_id, portals(id, name, slug, description, url, icon, color, is_active, created_at, updated_at)")
      .eq("user_id", agenteId)
    accessiblePortals = (portalAccess || [])
      .map((pa: any) => pa.portals)
      .filter((p: any) => p !== null && p !== undefined && p.is_active)
  }

  const daysRemaining = activeMembership
    ? differenceInDays(new Date(activeMembership.end_date), new Date())
    : 0

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"
  const firstName = profile?.full_name?.split(" ")[0] ?? ""

  return (
    <div className="space-y-8">
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}
      <Suspense fallback={null}><PortalAccessAlert /></Suspense>

      {/* ── Hero saludo ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{greeting}{firstName ? `, ${firstName}` : ""} 👋</p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Tu espacio de trabajo
          </h1>
        </div>
        {isSuperAdmin && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700">
            <Shield className="h-4 w-4" />
            Super Admin
          </div>
        )}
      </div>

      {!hasValidMembership ? (
        <AccessExpiredCard />
      ) : (
        <>
          {/* ── KPI strip ───────────────────────────────────────────────── */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Portales</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                  <Layers className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{accessiblePortals.length}</p>
              <p className="mt-0.5 text-xs text-slate-400">módulos activos</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Días</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{Math.max(0, daysRemaining)}</p>
              <p className="mt-0.5 text-xs text-slate-400">restantes en plan</p>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plan</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                  <Grid3X3 className="h-4 w-4 text-purple-600" />
                </div>
              </div>
              <p className="text-base font-bold text-slate-900 truncate">
                {activeMembership?.membership_plans?.name || (isSuperAdmin ? "Super Admin" : "Sin plan")}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-xs text-emerald-600 font-medium">Activo</p>
              </div>
            </div>
          </div>

          {/* ── Membresía ───────────────────────────────────────────────── */}
          {activeMembership && !isSuperAdmin && (
            <MembershipCard membership={activeMembership as any} daysRemaining={daysRemaining} />
          )}

          {/* ── Portales ────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Tus portales</h2>
                <p className="text-sm text-slate-500">Accede a tus herramientas empresariales</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                {accessiblePortals.length} activos
              </span>
            </div>
            <PortalsGrid portals={accessiblePortals as any} />
          </div>
        </>
      )}
    </div>
  )
}
