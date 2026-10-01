"use client"

import Link from "next/link"
import { salirDeLaCuenta } from "@/components/boton-cerrar-sesion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, LayoutDashboard, ChevronDown } from "lucide-react"
import type { Profile } from "@/lib/types"

interface DashboardHeaderProps { profile: Profile }

export function DashboardHeader({ profile }: DashboardHeaderProps) {
  // Cierra en el servidor y borra el modo "ver como" (ver app/auth/actions.ts)
  const handleLogout = salirDeLaCuenta

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : profile.email[0].toUpperCase()

  const isAdmin = profile.role === "admin" || profile.role === "superadmin"

  const roleLabel =
    profile.role === "superadmin" ? "Super Admin"
    : profile.role === "admin"    ? "Administrador"
    : "Usuario"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/90 backdrop-blur-md">
      <div className="container mx-auto flex h-[60px] items-center justify-between px-4 sm:px-6">

        {/* ── Marca ──────────────────────────────────────────────────────── */}
        <Link href="/dashboard" className="flex items-center" aria-label="LOMS 360, mis portales">
          <img src="/brand/loms360-logo.svg" alt="LOMS 360" className="h-7 w-auto" />
        </Link>

        {/* ── Acciones ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              asChild variant="ghost" size="sm"
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Link href="/admin">
                <Settings className="h-3.5 w-3.5" />
                Admin
              </Link>
            </Button>
          )}

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100 transition-colors focus:outline-none">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-brand-600 text-white text-[10px] font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-900 leading-none">{profile.full_name?.split(" ")[0] ?? "Usuario"}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{roleLabel}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56 rounded-xl border-slate-100 shadow-lg shadow-slate-200/60" align="end" forceMount>
              <DropdownMenuLabel className="font-normal px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-900 leading-none">{profile.full_name || "Usuario"}</p>
                <p className="text-xs text-slate-400 mt-1 leading-none truncate">{profile.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem asChild className="rounded-lg mx-1 focus:bg-slate-50">
                <Link href="/dashboard" className="flex items-center gap-2 text-sm">
                  <LayoutDashboard className="h-4 w-4 text-slate-400" />
                  Mi dashboard
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild className="rounded-lg mx-1 focus:bg-slate-50">
                  <Link href="/admin" className="flex items-center gap-2 text-sm">
                    <Settings className="h-4 w-4 text-slate-400" />
                    Panel de admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="rounded-lg mx-1 mb-1 text-rose-600 focus:bg-rose-50 focus:text-rose-700 cursor-pointer flex items-center gap-2 text-sm"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
