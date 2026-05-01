import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Calendar, Clock } from "lucide-react"
import type { Membership, MembershipPlan } from "@/lib/types"

interface MembershipCardProps {
  membership: Membership & { membership_plans?: MembershipPlan }
  daysRemaining: number
}

export function MembershipCard({ membership, daysRemaining }: MembershipCardProps) {
  const getStatusBadge = () => {
    if (daysRemaining <= 0) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (daysRemaining <= 7) {
      return <Badge variant="warning">Expiring Soon</Badge>
    }
    return <Badge variant="success">Active</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Membership Status</CardTitle>
              <CardDescription>Your current subscription details</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="font-medium">{membership.membership_plans?.name || "Unknown"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Expires</p>
              <p className="font-medium">
                {format(new Date(membership.end_date), "MMM d, yyyy")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Days Remaining</p>
              <p className="font-medium">
                {daysRemaining > 0 ? `${daysRemaining} days` : "Expired"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
