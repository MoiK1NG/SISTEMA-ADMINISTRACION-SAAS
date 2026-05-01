"use client"

import { useState } from "react"
import { format, differenceInDays, isPast } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Check, X, Trash2, CreditCard, UserCog } from "lucide-react"
import type { Profile, MembershipPlan, Portal, Membership } from "@/lib/types"
import {
  approveUser,
  disapproveUser,
  toggleUserActive,
  deleteUser,
} from "@/app/admin/actions"
import { MembershipDialog } from "./membership-dialog"

interface UserWithMembership extends Profile {
  memberships?: (Membership & {
    membership_plans?: MembershipPlan
  })[]
}

interface UsersTableProps {
  users: UserWithMembership[]
  plans: MembershipPlan[]
  portals: Portal[]
}

export function UsersTable({ users, plans, portals }: UsersTableProps) {
  const [selectedUser, setSelectedUser] = useState<UserWithMembership | null>(null)
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleApprove = async (userId: string) => {
    setLoading(userId)
    try {
      await approveUser(userId)
    } catch (error) {
      console.error("Error approving user:", error)
    }
    setLoading(null)
  }

  const handleDisapprove = async (userId: string) => {
    setLoading(userId)
    try {
      await disapproveUser(userId)
    } catch (error) {
      console.error("Error disapproving user:", error)
    }
    setLoading(null)
  }

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    setLoading(userId)
    try {
      await toggleUserActive(userId, isActive)
    } catch (error) {
      console.error("Error toggling user active:", error)
    }
    setLoading(null)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return
    }
    setLoading(userId)
    try {
      await deleteUser(userId)
    } catch (error) {
      console.error("Error deleting user:", error)
    }
    setLoading(null)
  }

  const getActiveMembership = (user: UserWithMembership) => {
    if (!user.memberships || user.memberships.length === 0) return null
    const active = user.memberships.find(
      (m) => m.is_active && !isPast(new Date(m.end_date))
    )
    return active || null
  }

  const getMembershipStatus = (user: UserWithMembership) => {
    const membership = getActiveMembership(user)
    if (!membership) return { status: "none", label: "No Membership", variant: "secondary" as const }
    
    const daysRemaining = differenceInDays(new Date(membership.end_date), new Date())
    
    if (daysRemaining < 0) {
      return { status: "expired", label: "Expired", variant: "destructive" as const }
    }
    if (daysRemaining <= 7) {
      return { status: "expiring", label: `${daysRemaining}d left`, variant: "warning" as const }
    }
    return { status: "active", label: `${daysRemaining}d left`, variant: "success" as const }
  }

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const membership = getActiveMembership(user)
              const membershipStatus = getMembershipStatus(user)

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.full_name || "No name"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.role === "superadmin"
                          ? "default"
                          : user.role === "admin"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_approved ? "success" : "warning"}>
                      {user.is_approved ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={membershipStatus.variant}>
                        {membershipStatus.label}
                      </Badge>
                      {membership && (
                        <span className="text-xs text-muted-foreground">
                          {membership.membership_plans?.name}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {membership ? (
                      <span className="text-sm">
                        {format(new Date(membership.end_date), "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.is_active}
                      onCheckedChange={(checked) => handleToggleActive(user.id, checked)}
                      disabled={loading === user.id}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={loading === user.id}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {user.is_approved ? (
                          <DropdownMenuItem onClick={() => handleDisapprove(user.id)}>
                            <X className="mr-2 h-4 w-4" />
                            Disapprove
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleApprove(user.id)}>
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user)
                            setMembershipDialogOpen(true)
                          }}
                        >
                          <CreditCard className="mr-2 h-4 w-4" />
                          Manage Membership
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(user.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <MembershipDialog
        open={membershipDialogOpen}
        onOpenChange={setMembershipDialogOpen}
        user={selectedUser}
        plans={plans}
      />
    </>
  )
}
