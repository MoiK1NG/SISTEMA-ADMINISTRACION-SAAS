import { createClient } from "@/lib/supabase/server"
import { PortalsManager } from "@/components/admin/portals-manager"

export default async function PortalsPage() {
  const supabase = await createClient()

  const { data: portals } = await supabase
    .from("portals")
    .select(`
      *,
      user_portal_access (
        user_id
      )
    `)
    .order("name", { ascending: true })

  return (
    <div className="space-y-6">
      <PortalsManager portals={portals || []} />
    </div>
  )
}
