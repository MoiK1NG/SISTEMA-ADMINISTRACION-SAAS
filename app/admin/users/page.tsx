import { createClient } from "@/lib/supabase/server"
import { UsersTable } from "@/components/admin/users-table" // o la importación que tengas de tu tabla de usuarios
import { redirect } from "next/navigation"

export default async function UsersPage() {
  const supabase = await createClient()

  // 1. Validamos de inmediato que supabase no sea nulo para complacer a TypeScript
  if (!supabase) {
    throw new Error("No se pudo conectar a la base de datos de Supabase")
  }

  // 2. Usamos el operador "!" en cada llamada de supabase para asegurar que no es nulo
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

  const { data: users } = await supabase!
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
      </div>
      <UsersTable users={users || []} />
    </div>
  )
}

      <UsersTable 
        users={users || []} 
        plans={plans || []} 
        portals={portals || []}
        currentUserRole={currentUserProfile?.role || "user"}
      />
    </div>
  )
}
