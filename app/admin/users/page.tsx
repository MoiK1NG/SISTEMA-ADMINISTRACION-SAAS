import { createClient } from "@/lib/supabase/server"
import { UsersTable } from "@/components/admin/users-table"

export default async function UsersPage() {
  const supabase = await createClient()

  // Obtener el rol del usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentUserProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single()

  const { data: users } = await supabase
    .from("profiles")
    .select(`
      *,
      memberships (
        id,
        plan_id,
        start_date,
        end_date,
        status,
        membership_plans (
          id,
          name,
          duration_days
        )
      )
    `)
    .order("created_at", { ascending: false })

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("is_active", true)
    .order("duration_days", { ascending: true })

  const { data: portals } = await supabase
    .from("portals")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
        <p className="text-muted-foreground">
          Gestiona cuentas de usuario, aprobaciones y membresías
        </p>
      </div>

      <UsersTable 
        users={users || []} 
        plans={plans || []} 
        portals={portals || []}
        currentUserRole={currentUserProfile?.role || "user"}
      />
    </div>
  )
}
