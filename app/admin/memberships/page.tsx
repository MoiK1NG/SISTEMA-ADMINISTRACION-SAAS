import { createClient } from "@/lib/supabase/server"
import { format, isPast } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function MembershipsPage() {
  const supabase = await createClient()

  const { data: memberships } = await supabase
    .from("memberships")
    .select(`
      *,
      profiles (
        id,
        full_name,
        email
      ),
      membership_plans (
        id,
        name,
        duration_days,
        price
      )
    `)
    .order("created_at", { ascending: false })

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("*")
    .order("duration_days", { ascending: true })

  const getMembershipStatus = (membership: any) => {
    if (!membership.is_active) {
      return { label: "Inactive", variant: "secondary" as const }
    }
    if (isPast(new Date(membership.end_date))) {
      return { label: "Expired", variant: "destructive" as const }
    }
    return { label: "Active", variant: "success" as const }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Memberships</h1>
        <p className="text-muted-foreground">
          View and manage all membership subscriptions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans?.map((plan) => {
          const activeMemberships = memberships?.filter(
            (m) => m.plan_id === plan.id && m.is_active && !isPast(new Date(m.end_date))
          ).length || 0

          return (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{plan.name}</CardTitle>
                <CardDescription>{plan.duration_days} days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeMemberships}</div>
                <p className="text-xs text-muted-foreground">
                  active subscriptions
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Memberships</CardTitle>
          <CardDescription>Complete list of membership records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships?.map((membership) => {
                const status = getMembershipStatus(membership)
                return (
                  <TableRow key={membership.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {membership.profiles?.full_name || "No name"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {membership.profiles?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{membership.membership_plans?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ${membership.membership_plans?.price}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(membership.start_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(membership.end_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {(!memberships || memberships.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No memberships found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
