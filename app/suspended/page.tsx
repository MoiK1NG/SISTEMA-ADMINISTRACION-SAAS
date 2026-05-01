import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Ban } from "lucide-react"
import { LogoutButton } from "@/components/logout-button"

export default async function SuspendedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, full_name")
    .eq("id", user.id)
    .single()

  if (profile?.is_active) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Account Suspended</CardTitle>
          <CardDescription className="text-base">
            Your account has been deactivated. Please contact an administrator for assistance.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  )
}
