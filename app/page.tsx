import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved, is_active")
      .eq("id", user.id)
      .single()

    if (profile && !profile.is_approved) {
      redirect("/pending")
    } else if (profile && !profile.is_active) {
      redirect("/suspended")
    } else {
      redirect("/dashboard")
    }
  }

  redirect("/login")
}
