import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, AlertTriangle } from "lucide-react"
import { LogoutButton } from "@/components/logout-button"

export default async function PendingPage() {
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
    .select("is_approved, full_name")
    .eq("id", user.id)
    .single()

  if (profile?.is_approved) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">Pending Approval</CardTitle>
          <CardDescription className="text-base">
            {profile?.full_name ? `Hi ${profile.full_name}, your` : "Your"} account is awaiting administrator approval. 
            You will be notified once your access has been granted.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  )
}
