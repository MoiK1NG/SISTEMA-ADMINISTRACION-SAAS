"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  ExternalLink,
  Building, 
  Calculator, 
  Users, 
  Package, 
  Contact, 
  Briefcase, 
  ShoppingCart, 
  FileText, 
  Settings, 
  Globe 
} from "lucide-react"
import type { Portal } from "@/lib/types"
import { PortalDialog } from "./portal-dialog"
import { deletePortal, togglePortalActive } from "@/app/admin/actions"

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

interface PortalWithAccess extends Portal {
  user_portal_access?: { user_id: string }[]
}

interface PortalsManagerProps {
  portals: PortalWithAccess[]
}

export function PortalsManager({ portals }: PortalsManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selectedPortal, setSelectedPortal] = useState<Portal | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const handleCreate = () => {
    setSelectedPortal(null)
    setDialogMode("create")
    setDialogOpen(true)
  }

  const handleEdit = (portal: Portal) => {
    setSelectedPortal(portal)
    setDialogMode("edit")
    setDialogOpen(true)
  }

  const handleDelete = async (portalId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este portal? Se revocarán todos los accesos asociados.")) {
      return
    }
    setLoading(portalId)
    try {
      await deletePortal(portalId)
    } catch (error) {
      console.error("Error al eliminar portal:", error)
    }
    setLoading(null)
  }

  const handleToggleActive = async (portalId: string, isActive: boolean) => {
    setLoading(portalId)
    try {
      await togglePortalActive(portalId, isActive)
    } catch (error) {
      console.error("Error al cambiar estado:", error)
    }
    setLoading(null)
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portales</h1>
          <p className="text-muted-foreground">
            Gestiona los portales empresariales disponibles para los usuarios
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Portal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {portals?.map((portal) => {
          const IconComponent = ICON_MAP[portal.icon || "building"] || Building
          
          return (
            <Card key={portal.id} className={!portal.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${portal.color}20` }}
                  >
                    <IconComponent
                      className="h-6 w-6"
                      style={{ color: portal.color || "#3b82f6" }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={portal.is_active}
                      onCheckedChange={(checked) => handleToggleActive(portal.id, checked)}
                      disabled={loading === portal.id}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={loading === portal.id}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(portal)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        {portal.url && (
                          <DropdownMenuItem asChild>
                            <a href={portal.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir Portal
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(portal.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{portal.name}</CardTitle>
                    <Badge variant={portal.is_active ? "success" : "secondary"}>
                      {portal.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1 line-clamp-2">
                    {portal.description || "Sin descripción"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Usuarios con acceso</span>
                    <span className="font-medium">
                      {portal.user_portal_access?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Slug</span>
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      /{portal.slug}
                    </code>
                  </div>
                  {portal.url && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">URL</span>
                      <a
                        href={portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver portal
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Card para crear nuevo portal */}
        <Card
          className="flex cursor-pointer flex-col items-center justify-center border-dashed transition-colors hover:border-primary hover:bg-muted/50"
          onClick={handleCreate}
        >
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <p className="mt-4 font-medium">Crear Nuevo Portal</p>
            <p className="text-sm text-muted-foreground">
              Agrega un portal empresarial
            </p>
          </CardContent>
        </Card>
      </div>

      <PortalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        portal={selectedPortal}
        mode={dialogMode}
      />
    </>
  )
}
