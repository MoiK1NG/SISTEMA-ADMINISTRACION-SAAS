import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  if (!profile || profile.role === "user") {
    redirect("/dashboard")
  }

  if (!profile.is_approved || !profile.is_active) {
    redirect("/pending")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader profile={profile} />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
