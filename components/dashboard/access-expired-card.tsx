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
            <CardTitle className="text-lg text-destructive">Access Expired</CardTitle>
            <CardDescription>
              Your membership has expired or is inactive
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Your access to the business portals has been suspended because your membership has expired 
          or has been deactivated. Please contact your administrator to renew your membership 
          and regain access to all features.
        </p>
      </CardContent>
    </Card>
  )
}
