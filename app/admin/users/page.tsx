import { requireClient } from "@/lib/supabase/require-client"
import { UsersTable } from "@/components/admin/users-table"
import { redirect } from "next/navigation"

export default async function UsersPage() {
  const supabase = await requireClient()

  // 1. Validamos de inmediato que el cliente de Supabase no sea nulo para complacer a TypeScript
  if (!supabase) {
    throw new Error("No se pudo conectar a la base de datos de Supabase.")
  }

  // 2. Comprobamos la autenticación y permisos de forma segura usando el operador "!"
  const { data: { user } } = await supabase!.auth.getUser()
  if (!user) redirect("/login")

  const { data: currentUserProfile } = await supabase!
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!currentUserProfile || currentUserProfile.role === "user") {
    redirect("/")
  }

  // 3. Obtenemos los datos necesarios para la tabla usando aserción de no-nulo
  const { data: users } = await supabase!
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })

  const { data: plans } = await supabase!
    .from("plans")
    .select("*")

  const { data: portals } = await supabase!
    .from("portals")
    .select("*")

  // 4. Retornamos todo el bloque visual agrupado correctamente dentro de la función principal
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground">
            Administra los usuarios de tu plataforma, sus roles, aprobaciones y accesos a portales.
          </p>
        </div>
      </div>

      <UsersTable 
        users={users || []} 
        plans={plans || []} 
        portals={portals || []} 
        currentUserRole={currentUserProfile.role}
      />
    </div>
  )
}
