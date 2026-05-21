"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Portal } from "@/lib/types"
import { createPortal, updatePortal } from "@/app/admin/actions"
import { Loader2, Building, Calculator, Users, Package, Contact, Briefcase, ShoppingCart, FileText, Settings, Globe } from "lucide-react"

const PORTAL_ICONS = [
  { value: "building", label: "Edificio", icon: Building },
  { value: "calculator", label: "Calculadora", icon: Calculator },
  { value: "users", label: "Usuarios", icon: Users },
  { value: "package", label: "Paquete", icon: Package },
  { value: "contact", label: "Contacto", icon: Contact },
  { value: "briefcase", label: "Maletín", icon: Briefcase },
  { value: "shopping-cart", label: "Carrito", icon: ShoppingCart },
  { value: "file-text", label: "Documento", icon: FileText },
  { value: "settings", label: "Configuración", icon: Settings },
  { value: "globe", label: "Web", icon: Globe },
]

const PORTAL_COLORS = [
  { value: "#3b82f6", label: "Azul" },
  { value: "#10b981", label: "Verde" },
  { value: "#8b5cf6", label: "Violeta" },
  { value: "#f59e0b", label: "Naranja" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#06b6d4", label: "Cian" },
  { value: "#84cc16", label: "Lima" },
  { value: "#6366f1", label: "Índigo" },
  { value: "#64748b", label: "Gris" },
]

interface PortalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portal?: Portal | null
  mode: "create" | "edit"
}

export function PortalDialog({
  open,
  onOpenChange,
  portal,
  mode,
}: PortalDialogProps) {
  const [name, setName] = useState(portal?.name || "")
  const [slug, setSlug] = useState(portal?.slug || "")
  const [description, setDescription] = useState(portal?.description || "")
  const [url, setUrl] = useState(portal?.url || "")
  const [icon, setIcon] = useState(portal?.icon || "building")
  const [color, setColor] = useState(portal?.color || "#3b82f6")
  const [isActive, setIsActive] = useState(portal?.is_active ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (mode === "create") {
      setSlug(generateSlug(value))
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      setError("El nombre y el slug son obligatorios")
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (mode === "create") {
        await createPortal({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          url: url.trim() || null,
          icon,
          color,
          is_active: isActive,
        })
      } else if (portal) {
        await updatePortal(portal.id, {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          url: url.trim() || null,
          icon,
          color,
          is_active: isActive,
        })
      }

      onOpenChange(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el portal")
    }

    setLoading(false)
  }

  const resetForm = () => {
    setName("")
    setSlug("")
    setDescription("")
    setUrl("")
    setIcon("building")
    setColor("#3b82f6")
    setIsActive(true)
    setError(null)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    } else if (portal && mode === "edit") {
      setName(portal.name)
      setSlug(portal.slug)
      setDescription(portal.description || "")
      setUrl(portal.url || "")
      setIcon(portal.icon || "building")
      setColor(portal.color || "#3b82f6")
      setIsActive(portal.is_active)
    }
    onOpenChange(open)
  }

  const SelectedIcon = PORTAL_ICONS.find((i) => i.value === icon)?.icon || Building

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Crear Nuevo Portal" : "Editar Portal"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Agrega un nuevo portal empresarial al sistema"
              : "Modifica la información del portal"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Portal *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Portal Empresarial"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL) *</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
              placeholder="Ej: empresarial"
            />
            <p className="text-xs text-muted-foreground">
              Identificador único para URLs. Solo letras, números y guiones.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve del portal..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL del Portal</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ejemplo.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Icono</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <SelectedIcon className="h-4 w-4" />
                      <span>{PORTAL_ICONS.find((i) => i.value === icon)?.label}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_ICONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span>{PORTAL_COLORS.find((c) => c.value === color)?.label}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_COLORS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: item.value }}
                        />
                        <span>{item.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="active">Portal Activo</Label>
              <p className="text-xs text-muted-foreground">
                Los portales inactivos no se muestran a los usuarios
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Vista previa */}
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Vista Previa
            </p>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}20` }}
              >
                <SelectedIcon className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <p className="font-medium">{name || "Nombre del Portal"}</p>
                <p className="text-xs text-muted-foreground">
                  {description || "Descripción del portal"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : mode === "create" ? (
              "Crear Portal"
            ) : (
              "Guardar Cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
