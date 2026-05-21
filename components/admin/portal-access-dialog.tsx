"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Profile, Portal } from "@/lib/types"
import { updateUserPortalAccess, getUserPortalAccess } from "@/app/admin/actions"
import { 
  Loader2, 
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

interface PortalAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: Profile | null
  portals: Portal[]
}

export function PortalAccessDialog({
  open,
  onOpenChange,
  user,
  portals,
}: PortalAccessDialogProps) {
  const [selectedPortals, setSelectedPortals] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAccess, setLoadingAccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && user) {
      loadUserAccess()
    }
  }, [open, user])

  const loadUserAccess = async () => {
    if (!user) return
    setLoadingAccess(true)
    try {
      const access = await getUserPortalAccess(user.id)
      setSelectedPortals(access.map((a) => a.portal_id))
    } catch (err) {
      console.error("Error al cargar accesos:", err)
    }
    setLoadingAccess(false)
  }

  const togglePortal = (portalId: string) => {
    setSelectedPortals((prev) =>
      prev.includes(portalId)
        ? prev.filter((id) => id !== portalId)
        : [...prev, portalId]
    )
  }

  const handleSave = async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      await updateUserPortalAccess(user.id, selectedPortals)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar accesos")
    }

    setLoading(false)
  }

  const selectAll = () => {
    setSelectedPortals(portals.filter((p) => p.is_active).map((p) => p.id))
  }

  const deselectAll = () => {
    setSelectedPortals([])
  }

  const activePortals = portals.filter((p) => p.is_active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar Acceso a Portales</DialogTitle>
          <DialogDescription>
            Selecciona los portales a los que{" "}
            <span className="font-medium">{user?.full_name || user?.email}</span>{" "}
            tendrá acceso
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loadingAccess ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">
                {selectedPortals.length} de {activePortals.length} portales seleccionados
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  disabled={selectedPortals.length === activePortals.length}
                >
                  Todos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  disabled={selectedPortals.length === 0}
                >
                  Ninguno
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {activePortals.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No hay portales activos disponibles
                  </div>
                ) : (
                  activePortals.map((portal) => {
                    const IconComponent = ICON_MAP[portal.icon || "building"] || Building
                    const isSelected = selectedPortals.includes(portal.id)

                    return (
                      <div
                        key={portal.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                          isSelected ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => togglePortal(portal.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePortal(portal.id)}
                        />
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${portal.color}20` }}
                        >
                          <IconComponent
                            className="h-4 w-4"
                            style={{ color: portal.color || "#3b82f6" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label className="cursor-pointer font-medium">
                            {portal.name}
                          </Label>
                          {portal.description && (
                            <p className="truncate text-xs text-muted-foreground">
                              {portal.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || loadingAccess}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Accesos"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
