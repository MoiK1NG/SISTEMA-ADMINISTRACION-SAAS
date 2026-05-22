import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Calendar, Clock, TrendingUp } from "lucide-react"

// Definimos interfaces de soporte si no se importan de tu tipo centralizado
interface MembershipPlan {
  name: string
  duration_days: number
  price: number
}

interface Membership {
  status: string
  start_date: string
  end_date: string
  membership_plans?: MembershipPlan
}

interface MembershipCardProps {
  membership?: Membership
  daysRemaining: number
}

export function MembershipCard({ membership, daysRemaining }: MembershipCardProps) {
  if (!membership) return null

  const plan = membership.membership_plans
  const totalDays = plan?.duration_days || 30
  
  // Calculamos el porcentaje transcurrido asegurando valores seguros
  const percentageElapsed = Math.min(
    100,
    Math.max(0, ((totalDays - daysRemaining) / totalDays) * 100)
  )

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold">Membresía Activa</CardTitle>
          <CardDescription>Detalles de tu suscripción actual</CardDescription>
        </div>
        <Badge variant={membership.status === "active" ? "default" : "secondary"}>
          {membership.status === "active" ? "Activa" : "Inactiva"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground font-semibold">Plan contratado</p>
              <h3 className="text-lg font-bold">{plan?.name || "Plan de Acceso"}</h3>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground font-semibold">Precio del plan</p>
              <h3 className="text-lg font-bold">${plan?.price || 0} USD</h3>
            </div>
          </div>
        </div>

        {/* Reemplazo nativo de la barra de progreso de Shadcn */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" /> Días transcurridos
            </span>
            <span className="font-semibold">{Math.max(0, totalDays - daysRemaining)} / {totalDays} días</span>
          </div>
          {/* Contenedor de la barra */}
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            {/* Relleno animado de progreso con Tailwind */}
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500 ease-in-out" 
              style={{ width: `${percentageElapsed}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Fecha de inicio:</span>
            <span className="font-medium">
              {new Date(membership.start_date).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Fecha de expiración:</span>
            <span className="font-medium text-destructive">
              {new Date(membership.end_date).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
