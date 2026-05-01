import { createClient } from "@/lib/supabase/server"
import { UsersTable } from "@/components/admin/users-table"

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from("profiles")
    .select(`
      *,
      memberships (
        id,
        plan_id,
        start_date,
        end_date,
        is_active,
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
    .order("duration_days", { ascending: true })

  const { data: portals } = await supabase
    .from("portals")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage user accounts, approvals, and memberships
        </p>
      </div>

      <UsersTable 
        users={users || []} 
        plans={plans || []} 
        portals={portals || []}
      />
    </div>
  )
}
