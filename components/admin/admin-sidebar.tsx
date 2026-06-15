"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Users, LayoutDashboard, CreditCard, Grid3X3,
  BarChart3, Bell, ClipboardList, Layers,
} from "lucide-react"

const NAV_MAIN = [
  { title: "Panel de Control", href: "/admin",             icon: LayoutDashboard },
  { title: "Usuarios",         href: "/admin/users",       icon: Users           },
  { title: "Membresías",       href: "/admin/memberships", icon: CreditCard      },
  { title: "Planes",           href: "/admin/plans",       icon: Layers          },
  { title: "Portales",         href: "/admin/portals",     icon: Grid3X3         },
]

const NAV_ANALYTICS = [
  { title: "Estadísticas", href: "/admin/stats",  icon: BarChart3     },
  { title: "Alertas",      href: "/admin/alerts", icon: Bell          },
  { title: "Auditoría",    href: "/admin/audit",  icon: ClipboardList },
]

function NavLink({ href, icon: Icon, title }: { href: string; icon: React.ElementType; title: string }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href))
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {title}
    </Link>
  )
}

export function AdminSidebar() {
  return (
    <aside className="hidden lg:flex w-64 flex-col border-r bg-card min-h-[calc(100vh-4rem)]">
      <nav className="flex flex-col gap-1 p-4">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Gestión
        </p>
        {NAV_MAIN.map(item => <NavLink key={item.href} {...item} />)}

        <div className="my-3 h-px bg-border" />

        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Análisis
        </p>
        {NAV_ANALYTICS.map(item => <NavLink key={item.href} {...item} />)}
      </nav>
    </aside>
  )
}
