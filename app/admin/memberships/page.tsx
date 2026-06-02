import { requireClient } from "@/lib/supabase/require-client"
  import { redirect } from "next/navigation"

export default async function MembershipsPage() {
 const supabase = await requireClient()
if (!supabase) throw new Error("No se pudo conectar a la base de datos")

// Obtener conteos
const { count: totalUsers } = await supabase
  .from("profiles")
  .select("*", { count: "exact", head: true })

  // 1. Verificar si el usuario está autenticado y es administrador
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role === "user") {
    redirect("/")
  }

  // 2. Traer la lista de membresías limpia
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Membresías</h1>
      </div>
      
      {/* Estructura básica de la tabla para que renderice */}
      <div className="rounded-md border bg-card">
        <div className="p-4 text-muted-foreground text-sm">
          Se encontraron {(memberships || []).length} membresías registradas.
        </div>
        {/* Aquí continúa el diseño visual de tus tarjetas o tablas de v0 */}
      </div>
    </div>
  )
}
