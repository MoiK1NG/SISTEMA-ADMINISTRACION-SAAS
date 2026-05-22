import { createClient } from "@/lib/supabase/server"
import { PortalsManager } from "@/components/admin/portals-manager"

export default async function PortalsPage() {
  const supabase = await createClient()
  
  if (!supabase) {
    throw new Error("No se pudo conectar a la base de datos de Supabase")
  }

  const { data: portals } = await supabase!
    .from("portals")
    .select(`
      *,
      profiles:user_id (
        full_name,
        email
      )
    `)
    .order("created_at", { ascending: false })

  // Aquí continúa el resto del código de tu componente...
}

  return (
    <div className="space-y-6">
      <PortalsManager portals={portals || []} />
    </div>
  )
}
