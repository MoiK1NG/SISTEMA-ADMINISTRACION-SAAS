import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Grid3X3 } from "lucide-react"

export default async function PortalsPage() {
  const supabase = await createClient()

  const { data: portals } = await supabase
    .from("portals")
    .select(`
      *,
      user_portal_access (
        id,
        user_id
      )
    `)
    .order("name", { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portals</h1>
        <p className="text-muted-foreground">
          Manage business portals available to users
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {portals?.map((portal) => (
          <Card key={portal.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Grid3X3 className="h-5 w-5 text-primary" />
                </div>
                <Badge variant={portal.is_active ? "success" : "secondary"}>
                  {portal.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardTitle className="mt-4">{portal.name}</CardTitle>
              <CardDescription>{portal.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Users with access</span>
                <span className="font-medium">
                  {portal.user_portal_access?.length || 0}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Slug</span>
                <code className="rounded bg-muted px-2 py-1 text-xs">
                  /{portal.slug}
                </code>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!portals || portals.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Grid3X3 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                No portals configured yet
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
