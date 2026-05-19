import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl">Configuration Required</CardTitle>
            <CardDescription>
              Supabase is not configured. Please add the required environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <code className="block bg-muted p-2 rounded text-sm">NEXT_PUBLIC_SUPABASE_URL</code>
            <code className="block bg-muted p-2 rounded text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }
  
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
