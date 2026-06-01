"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ExternalLink, 
  Grid3X3,
  Building, 
  Calculator, 
  Users, 
  Package, 
  Contact, 
  Briefcase, 
  ShoppingCart, 
  FileText, 
  Settings, 
  Globe,
  ArrowRight
} from "lucide-react"
import type { Portal } from "@/lib/types"

interface PortalsGridProps {
  portals: Portal[]
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  building: Building,
  calculator: Calculator,
  users: Users,
  package: Package,
  contact: Contact,
  briefcase: Briefcase,
  "shopping-cart": ShoppingCart,
  "file-text": FileText,
  settings: Settings,
  globe: Globe,
}

export function PortalsGrid({ portals }: PortalsGridProps) {
  if (portals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Grid3X3 className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="mt-4 text-lg font-medium">Sin portales asignados</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
            Aún no tienes acceso a ningún portal. Contacta a tu administrador para solicitar acceso.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {portals.map((portal) => {
        const IconComponent = ICON_MAP[portal.icon || "building"] || Grid3X3
        const portalColor = portal.color || "#3b82f6"

        return (
          <Card 
            key={portal.id} 
            className="group relative overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
          >
            {/* Decoración de fondo */}
            <div 
              className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full opacity-10 transition-opacity group-hover:opacity-20"
              style={{ backgroundColor: portalColor }}
            />
            
            <CardHeader className="pb-3">
              <div className="flex items-start gap-4">
                <div 
                  className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${portalColor}15` }}
                >
                  <IconComponent 
                    className="h-6 w-6" 
                    style={{ color: portalColor }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{portal.name}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {portal.description || "Portal empresarial"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {portal.url ? (
                <Button 
                  className="w-full group/btn" 
                  variant="outline"
                  asChild
                >
                  <a href={portal.url} target="_blank" rel="noopener noreferrer">
                    <span>Acceder al Portal</span>
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </a>
                </Button>
              ) : (
                <Button className="w-full" variant="outline" disabled>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Próximamente
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
