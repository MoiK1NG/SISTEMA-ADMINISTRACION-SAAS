import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export function AccessExpiredCard() {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-lg text-destructive">Acceso Expirado</CardTitle>
            <CardDescription>
              Tu membresía ha expirado o está inactiva
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tu acceso a los portales empresariales ha sido suspendido porque tu membresía ha expirado 
          o ha sido desactivada. Por favor contacta a tu administrador para renovar tu membresía 
          y recuperar el acceso a todas las funcionalidades.
        </p>
      </CardContent>
    </Card>
  )
}
