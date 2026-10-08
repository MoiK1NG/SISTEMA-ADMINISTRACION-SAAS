"use client"

import Link from "next/link"
import { salirDeLaCuenta } from "@/components/boton-cerrar-sesion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User, Menu, KeyRound } from "lucide-react"
import type { Profile } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

interface AdminHeaderProps {
  profile: Profile
}

export function AdminHeader({ profile }: AdminHeaderProps) {
  // Cierra en el servidor y borra el modo "ver como" (ver app/auth/actions.ts)
  const handleLogout = salirDeLaCuenta

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email[0].toUpperCase()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-3">
            <img src="/brand/loms360-logo.svg" alt="LOMS 360" className="h-7 w-auto" />
            <span className="hidden text-sm font-semibold text-brand-900 sm:inline-block">Administración</span>
          </Link>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {profile.role === "superadmin" ? "Super Admin" : "Admin"}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link href="/dashboard">
              <User className="mr-2 h-4 w-4" />
              Panel de Usuario
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile.full_name || "Usuario"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {profile.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="lg:hidden">
                <Link href="/dashboard">
                  <User className="mr-2 h-4 w-4" />
                  Panel de Usuario
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/cambiar-clave">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Cambiar contraseña
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
