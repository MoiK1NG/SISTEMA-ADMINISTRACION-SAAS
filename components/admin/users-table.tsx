"use client"

import { useState } from "react"
import { format, differenceInDays, isPast } from "date-fns"
import { es } from "date-fns/locale"
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
import { MoreHorizontal, Check, X, Trash2, CreditCard, Grid3X3, Shield } from "lucide-react"
import type { Profile, MembershipPlan, Portal, Membership, MembershipStatus } from "@/lib/types"
import {
  approveUser,
  disapproveUser,
  toggleUserActive,
  deleteUser,
  updateUserRole,
} from "@/app/admin/actions"
import { MembershipDialog } from "./membership-dialog"
import { PortalAccessDialog } from "./portal-access-dialog"

interface UserWithMembership extends Profile {
  memberships?: (Membership & {
    membership_plans?: MembershipPlan
  })[]
}

interface UsersTableProps {
  users: UserWithMembership[]
  plans: MembershipPlan[]
  portals: Portal[]
  currentUserRole: string
}

export function UsersTable({ users, plans, portals, currentUserRole }: UsersTableProps) {
  const [selectedUser, setSelectedUser] = useState<UserWithMembership | null>(null)
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false)
  const [portalAccessDialogOpen, setPortalAccessDialogOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleApprove = async (userId: string) => {
    setLoading(userId)
    try {
      await approveUser(userId)
    } catch (error) {
      console.error("Error al aprobar usuario:", error)
    }
    setLoading(null)
  }

  const handleDisapprove = async (userId: string) => {
    setLoading(userId)
    try {
      await disapproveUser(userId)
    } catch (error) {
      console.error("Error al desaprobar usuario:", error)
    }
    setLoading(null)
  }

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    setLoading(userId)
    try {
      await toggleUserActive(userId, isActive)
    } catch (error) {
      console.error("Error al cambiar estado activo:", error)
    }
    setLoading(null)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.")) {
      return
    }
    setLoading(userId)
    try {
      await deleteUser(userId)
    } catch (error) {
      console.error("Error al eliminar usuario:", error)
    }
    setLoading(null)
  }

  const handleRoleChange = async (userId: string, newRole: "user" | "admin" | "superadmin") => {
    if (!confirm(`¿Estás seguro de que deseas cambiar el rol a ${newRole}?`)) {
      return
    }
    setLoading(userId)
    try {
      await updateUserRole(userId, newRole)
    } catch (error) {
      console.error("Error al cambiar rol:", error)
    }
    setLoading(null)
  }

  const getActiveMembership = (user: UserWithMembership) => {
    if (!user.memberships || user.memberships.length === 0) return null
    const active = user.memberships.find(
      (m) => m.status === "active" && !isPast(new Date(m.end_date))
    )
    return active || null
  }

  const getMembershipStatus = (user: UserWithMembership) => {
    const membership = getActiveMembership(user)
    if (!membership) return { status: "none", label: "Sin Membresía", variant: "secondary" as const }
    
    const daysRemaining = differenceInDays(new Date(membership.end_date), new Date())
    
    if (daysRemaining < 0) {
      return { status: "expired", label: "Expirada", variant: "destructive" as const }
    }
    if (daysRemaining <= 7) {
      return { status: "expiring", label: `${daysRemaining}d restantes`, variant: "warning" as const }
    }
    return { status: "active", label: `${daysRemaining}d restantes`, variant: "success" as const }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "superadmin":
        return "default"
      case "admin":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "superadmin":
        return "Super Admin"
      case "admin":
        return "Admin"
      default:
        return "Usuario"
    }
  }

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Aprobación</TableHead>
              <TableHead>Membresía</TableHead>
              <TableHead>Expiración</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
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
                      <p className="font-medium">{user.full_name || "Sin nombre"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_approved ? "success" : "warning"}>
                      {user.is_approved ? "Aprobado" : "Pendiente"}
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
                        {format(new Date(membership.end_date), "d MMM, yyyy", { locale: es })}
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
                          <span className="sr-only">Acciones</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        
                        {/* Aprobar/Desaprobar */}
                        {user.is_approved ? (
                          <DropdownMenuItem onClick={() => handleDisapprove(user.id)}>
                            <X className="mr-2 h-4 w-4" />
                            Desaprobar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleApprove(user.id)}>
                            <Check className="mr-2 h-4 w-4" />
                            Aprobar
                          </DropdownMenuItem>
                        )}
                        
                        {/* Gestionar Membresía */}
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user)
                            setMembershipDialogOpen(true)
                          }}
                        >
                          <CreditCard className="mr-2 h-4 w-4" />
                          Gestionar Membresía
                        </DropdownMenuItem>
                        
                        {/* Gestionar Acceso a Portales */}
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user)
                            setPortalAccessDialogOpen(true)
                          }}
                        >
                          <Grid3X3 className="mr-2 h-4 w-4" />
                          Acceso a Portales
                        </DropdownMenuItem>
                        
                        {/* Cambiar Rol (solo superadmin) */}
                        {currentUserRole === "superadmin" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                              Cambiar Rol
                            </DropdownMenuLabel>
                            {user.role !== "user" && (
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, "user")}>
                                <Shield className="mr-2 h-4 w-4" />
                                Hacer Usuario
                              </DropdownMenuItem>
                            )}
                            {user.role !== "admin" && (
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, "admin")}>
                                <Shield className="mr-2 h-4 w-4" />
                                Hacer Admin
                              </DropdownMenuItem>
                            )}
                            {user.role !== "superadmin" && (
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, "superadmin")}>
                                <Shield className="mr-2 h-4 w-4" />
                                Hacer Super Admin
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(user.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar Usuario
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
                  No se encontraron usuarios
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

      <PortalAccessDialog
        open={portalAccessDialogOpen}
        onOpenChange={setPortalAccessDialogOpen}
        user={selectedUser}
        portals={portals}
      />
    </>
  )
}
