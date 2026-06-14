"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pencil, Trash2, Plus, Users, Clock, DollarSign, Loader2 } from "lucide-react"
import { createMembershipPlan, updateMembershipPlan, deleteMembershipPlan } from "@/app/admin/actions"
import { useRouter } from "next/navigation"

interface Plan {
  id: string
  name: string
  description: string | null
  price: number
  duration_days: number
  is_active: boolean
  activeCount: number
}

const EMPTY: Omit<Plan, "id" | "activeCount"> = {
  name: "", description: "", price: 0, duration_days: 30, is_active: true
}

export function PlansManager({ plans }: { plans: Plan[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true) }
  function openEdit(p: Plan) { setEditing(p); setForm({ name: p.name, description: p.description || "", price: p.price, duration_days: p.duration_days, is_active: p.is_active }); setError(null); setOpen(true) }

  function handleSave() {
    setError(null)
    if (!form.name.trim()) { setError("El nombre es requerido"); return }
    if (form.price < 0)    { setError("El precio debe ser positivo"); return }
    startTransition(async () => {
      try {
        if (editing) {
          await updateMembershipPlan(editing.id, form)
        } else {
          await createMembershipPlan(form)
        }
        setOpen(false)
        router.refresh()
      } catch (e: any) { setError(e.message) }
    })
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este plan? Solo es posible si no tiene suscripciones activas.")) return
    startTransition(async () => {
      try { await deleteMembershipPlan(id); router.refresh() }
      catch (e: any) { alert(e.message) }
    })
  }

  const fmt = (n: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Planes disponibles</h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo plan
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map(p => (
          <Card key={p.id} className={!p.is_active ? "opacity-60" : undefined}>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-lg leading-none">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                </div>
                <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">
                  {p.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <DollarSign className="h-3.5 w-3.5 mx-auto text-emerald-500 mb-0.5" />
                  <p className="text-xs font-bold">{fmt(p.price)}</p>
                  <p className="text-[10px] text-muted-foreground">Precio</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <Clock className="h-3.5 w-3.5 mx-auto text-blue-500 mb-0.5" />
                  <p className="text-xs font-bold">{p.duration_days}d</p>
                  <p className="text-[10px] text-muted-foreground">Duración</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <Users className="h-3.5 w-3.5 mx-auto text-purple-500 mb-0.5" />
                  <p className="text-xs font-bold">{p.activeCount}</p>
                  <p className="text-[10px] text-muted-foreground">Activos</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)} disabled={p.activeCount > 0}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {plans.length === 0 && (
          <div className="col-span-3 rounded-xl border border-dashed border-muted-foreground/30 py-16 text-center text-muted-foreground">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay planes creados aún</p>
            <Button variant="link" size="sm" onClick={openCreate}>Crear el primero</Button>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plan" : "Crear nuevo plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Plan Pro" />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción (opcional)</Label>
              <Input value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción breve" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Precio (DOP)</Label>
                <Input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Duración (días)</Label>
                <Input type="number" min="1" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              Plan activo (visible para asignar)
            </label>
            <Button className="w-full" onClick={handleSave} disabled={pending}>
              {pending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando…</> : (editing ? "Guardar cambios" : "Crear plan")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
