import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default async function DashboardLayout({
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

  if (!profile) {
    redirect("/login")
  }

  if (!profile.is_approved) {
    redirect("/pending")
  }

  if (!profile.is_active) {
    redirect("/suspended")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader profile={profile} />
      <main className="container mx-auto px-4 py-6 lg:py-8">
        {children}
      </main>
    </div>
  )
}
