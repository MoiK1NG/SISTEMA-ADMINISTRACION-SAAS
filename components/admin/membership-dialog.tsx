"use client"

import { useState } from "react"
import { format, addDays } from "date-fns"
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
import type { Profile, MembershipPlan, Membership } from "@/lib/types"
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
      console.error("Error assigning membership:", error)
    }
    setLoading(false)
  }

  const activeMembership = user?.memberships?.find((m) => m.is_active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Membership</DialogTitle>
          <DialogDescription>
            Assign or update membership for {user?.full_name || user?.email}
          </DialogDescription>
        </DialogHeader>

        {activeMembership && (
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium">Current Membership</p>
            <p className="text-sm text-muted-foreground">
              {activeMembership.membership_plans?.name} - Expires{" "}
              {format(new Date(activeMembership.end_date), "MMM d, yyyy")}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan">Membership Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} ({plan.duration_days} days) - ${plan.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {selectedPlanDetails && (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-medium">Membership Details</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>Plan: {selectedPlanDetails.name}</p>
                <p>Duration: {selectedPlanDetails.duration_days} days</p>
                <p>Start: {format(new Date(startDate), "MMM d, yyyy")}</p>
                <p>End: {format(new Date(endDate), "MMM d, yyyy")}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedPlan || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Membership"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
