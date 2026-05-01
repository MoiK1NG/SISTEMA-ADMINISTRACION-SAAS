import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, ShoppingCart, Users, BarChart3, Megaphone, Grid3X3 } from "lucide-react"
import type { Portal } from "@/lib/types"

interface PortalsGridProps {
  portals: Portal[]
}

const portalIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  ecommerce: ShoppingCart,
  crm: Users,
  analytics: BarChart3,
  marketing: Megaphone,
}

export function PortalsGrid({ portals }: PortalsGridProps) {
  if (portals.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Grid3X3 className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No portals assigned</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
            {"You don't have access to any portals yet. Contact your administrator to request access."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {portals.map((portal) => {
        const Icon = portalIcons[portal.slug] || Grid3X3

        return (
          <Card key={portal.id} className="group hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{portal.name}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {portal.description || "Access this portal to manage your business operations."}
              </CardDescription>
              <Button className="w-full" variant="outline" disabled>
                <ExternalLink className="mr-2 h-4 w-4" />
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
