import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Ban, AlertTriangle } from "lucide-react"
import { LogoutButton } from "@/components/logout-button"

export default async function SuspendedPage() {
  const supabase = await createClient()
  
  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl">Configuración Requerida</CardTitle>
            <CardDescription>
              Supabase no está configurado. Por favor agrega las variables de entorno requeridas.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">Volver al Inicio</Link>
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
          <CardTitle className="text-2xl">Cuenta Suspendida</CardTitle>
          <CardDescription className="text-base">
            Tu cuenta ha sido desactivada. Por favor contacta a un administrador para obtener ayuda.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  )
}
