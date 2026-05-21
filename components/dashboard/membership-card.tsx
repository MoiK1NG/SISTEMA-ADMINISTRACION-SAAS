import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CreditCard, Calendar, Clock, TrendingUp } from "lucide-react"
import type { Membership, MembershipPlan } from "@/lib/types"

interface MembershipCardProps {
  membership: Membership & { membership_plans?: MembershipPlan }
  daysRemaining: number
}

export function MembershipCard({ membership, daysRemaining }: MembershipCardProps) {
  const totalDays = membership.membership_plans?.duration_days || 30
  const usedDays = totalDays - daysRemaining
  const progressPercent = Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100))

  const getStatusBadge = () => {
    if (daysRemaining <= 0) {
      return <Badge variant="destructive">Expirada</Badge>
    }
    if (daysRemaining <= 7) {
      return <Badge variant="warning">Por Expirar</Badge>
    }
    return <Badge variant="success">Activa</Badge>
  }

  const getProgressColor = () => {
    if (daysRemaining <= 0) return "bg-destructive"
    if (daysRemaining <= 7) return "bg-yellow-500"
    return "bg-primary"
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Tu Membresía</CardTitle>
              <CardDescription>Detalles de tu suscripción actual</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Barra de progreso */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uso de membresía</span>
              <span className="font-medium">{Math.round(progressPercent)}% transcurrido</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor()}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Inicio: {format(new Date(membership.start_date), "d MMM", { locale: es })}</span>
              <span>Fin: {format(new Date(membership.end_date), "d MMM", { locale: es })}</span>
            </div>
          </div>

          {/* Detalles en grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <CreditCard className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="font-semibold">{membership.membership_plans?.name || "Desconocido"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Calendar className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expira</p>
                <p className="font-semibold">
                  {format(new Date(membership.end_date), "d MMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Días Restantes</p>
                <p className="font-semibold">
                  {daysRemaining > 0 ? `${daysRemaining} días` : "Expirada"}
                </p>
              </div>
            </div>
          </div>

          {/* Mensaje de renovación si está por expirar */}
          {daysRemaining > 0 && daysRemaining <= 7 && (
            <div className="flex items-center gap-3 rounded-xl border border-yellow-500/50 bg-yellow-500/10 p-4">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-600">Tu membresía expira pronto</p>
                <p className="text-sm text-yellow-600/80">
                  Contacta al administrador para renovar tu suscripción
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
