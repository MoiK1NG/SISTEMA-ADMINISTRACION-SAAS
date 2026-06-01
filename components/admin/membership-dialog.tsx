"use client"

import { useState } from "react"
import { format, addDays } from "date-fns"
import { es } from "date-fns/locale"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Profile, MembershipPlan, Membership, MembershipStatus } from "@/lib/types"
import { assignMembership } from "@/app/admin/actions"
import { Loader2 } from "lucide-react"

interface UserWithMembership extends Profile {
  memberships?: (Membership & {
    membership_plans?: MembershipPlan
  })[]
}

interface MembershipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserWithMembership | null
  plans: MembershipPlan[]
}

export function MembershipDialog({
  open,
  onOpenChange,
  user,
  plans,
}: MembershipDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>("")
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [loading, setLoading] = useState(false)

  const selectedPlanDetails = plans.find((p) => p.id === selectedPlan)
  const endDate = selectedPlanDetails
    ? format(addDays(new Date(startDate), selectedPlanDetails.duration_days), "yyyy-MM-dd")
    : ""

  const handleAssign = async () => {
    if (!user || !selectedPlan) return
    setLoading(true)
    try {
      await assignMembership(user.id, selectedPlan, startDate)
      onOpenChange(false)
      setSelectedPlan("")
      setStartDate(format(new Date(), "yyyy-MM-dd"))
    } catch (error) {
      console.error("Error al asignar membresía:", error)
    }
    setLoading(false)
  }

  const activeMembership = user?.memberships?.find((m) => m.status === "active")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar Membresía</DialogTitle>
          <DialogDescription>
            Asignar o actualizar membresía para {user?.full_name || user?.email}
          </DialogDescription>
        </DialogHeader>

        {activeMembership && (
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium">Membresía Actual</p>
            <p className="text-sm text-muted-foreground">
              {activeMembership.membership_plans?.name} - Expira el{" "}
              {format(new Date(activeMembership.end_date), "d MMM, yyyy", { locale: es })}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan">Plan de Membresía</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} ({plan.duration_days} días) - ${plan.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha de Inicio</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {selectedPlanDetails && (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-medium">Detalles de la Membresía</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>Plan: {selectedPlanDetails.name}</p>
                <p>Duración: {selectedPlanDetails.duration_days} días</p>
                <p>Inicio: {format(new Date(startDate), "d MMM, yyyy", { locale: es })}</p>
                <p>Fin: {format(new Date(endDate), "d MMM, yyyy", { locale: es })}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAssign} disabled={!selectedPlan || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Asignando...
              </>
            ) : (
              "Asignar Membresía"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
