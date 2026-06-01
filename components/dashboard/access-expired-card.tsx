import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Mail, RefreshCw } from "lucide-react"

export function AccessExpiredCard() {
  return (
    <Card className="border-destructive/50 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-xl text-destructive">Acceso Expirado</CardTitle>
            <CardDescription>
              Tu membresía ha expirado o está inactiva
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-destructive/20 bg-card p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu acceso a los portales empresariales ha sido suspendido porque tu membresía ha expirado 
            o ha sido desactivada. Para recuperar el acceso a todas las funcionalidades, por favor 
            contacta a tu administrador.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/50 p-4">
            <RefreshCw className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Renovar Membresía</p>
              <p className="text-sm text-muted-foreground">
                Solicita una renovación de tu plan actual
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border bg-muted/50 p-4">
            <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Soporte</p>
              <p className="text-sm text-muted-foreground">
                Contacta al administrador del sistema
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
