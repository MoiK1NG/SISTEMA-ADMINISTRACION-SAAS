"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
import { Building2, LogOut, Settings } from "lucide-react"
import type { Profile } from "@/lib/types"

interface DashboardHeaderProps {
  profile: Profile
}

export function DashboardHeader({ profile }: DashboardHeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email[0].toUpperCase()

  const isAdmin = profile.role === "admin" || profile.role === "superadmin"

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold hidden sm:inline-block">Business Portal</span>
        </Link>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <Button variant="outline" size="sm" asChild className="hidden sm:flex">
              <Link href="/admin">
                <Settings className="mr-2 h-4 w-4" />
                Admin Panel
              </Link>
            </Button>
          )}

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
                  <p className="text-sm font-medium leading-none">{profile.full_name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {profile.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem asChild className="sm:hidden">
                  <Link href="/admin">
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
