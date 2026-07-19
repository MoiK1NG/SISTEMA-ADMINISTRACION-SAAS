import { redirect } from "next/navigation"
import { requireClient } from "@/lib/supabase/require-client"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) {
    // No redirigir a /login: el middleware reenviaría a /dashboard → loop infinito.
    // /pending es una página pública que corta el ciclo.
    redirect("/pending")
  }

  const isSuperAdmin = profile.role === 'superadmin'

  if (!isSuperAdmin) {
    if (!profile.is_approved) redirect("/pending")
    if (!profile.is_active) redirect("/suspended")
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <DashboardHeader profile={profile} />
      <main className="container mx-auto px-4 py-7 lg:py-10 max-w-6xl">
        {children}
      </main>
    </div>
  )
}
