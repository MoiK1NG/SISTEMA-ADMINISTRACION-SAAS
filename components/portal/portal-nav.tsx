"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, ClipboardList, ShoppingCart, Boxes, Package,
  Users, Receipt, UtensilsCrossed, Settings, Grid2x2, Banknote,
} from "lucide-react"

interface Seccion {
  href:  string
  label: string
  icon:  React.ComponentType<{ className?: string }>
}

// Secciones de cada portal. La primera es siempre la raíz del portal.
const PORTALES: Record<string, { color: string; secciones: Seccion[] }> = {
  panaderia: {
    color: "#f97316",
    secciones: [
      { href: "/portal/panaderia",            label: "Panel",      icon: LayoutDashboard },
      { href: "/portal/panaderia/produccion", label: "Producción", icon: ClipboardList   },
      { href: "/portal/panaderia/ventas",     label: "Ventas",     icon: ShoppingCart    },
      { href: "/portal/panaderia/inventario", label: "Inventario", icon: Boxes           },
      { href: "/portal/panaderia/productos",  label: "Productos",  icon: Package         },
    ],
  },
  pos: {
    color: "#8b5cf6",
    secciones: [
      { href: "/portal/pos",           label: "Caja",      icon: Grid2x2 },
      { href: "/portal/pos/productos", label: "Productos", icon: Package },
      { href: "/portal/pos/ventas",    label: "Ventas",    icon: Receipt },
    ],
  },
  prestamos: {
    color: "#1d4ed8",
    secciones: [
      { href: "/portal/prestamos",          label: "Cartera",  icon: LayoutDashboard },
      { href: "/portal/prestamos/clientes", label: "Clientes", icon: Users           },
    ],
  },
  cobros: {
    color: "#10b981",
    secciones: [
      { href: "/portal/cobros",          label: "Cobros",   icon: Banknote },
      { href: "/portal/cobros/clientes", label: "Clientes", icon: Users    },
    ],
  },
  restaurante: {
    color: "#ef4444",
    secciones: [
      { href: "/portal/restaurante",               label: "Mesas",  icon: LayoutDashboard },
      { href: "/portal/restaurante/menu",          label: "Menú",   icon: UtensilsCrossed },
      { href: "/portal/restaurante/caja",          label: "Caja",   icon: Receipt         },
      { href: "/portal/restaurante/configuracion", label: "Ajustes",icon: Settings        },
    ],
  },
}

interface Props {
  portal: keyof typeof PORTALES | string
  /** Alto de la cabecera de la página: 16 (h-16) o 14 (h-14, el POS). */
  top?: 14 | 16
  /** El POS usa layout de alto fijo, donde sticky sobra. */
  sticky?: boolean
}

/**
 * Barra de secciones del portal. Va en TODAS las páginas del portal —
 * incluidas las internas — para poder saltar entre secciones sin volver
 * al panel. Scrollea en horizontal cuando no entra en pantallas chicas.
 */
export function PortalNav({ portal, top = 16, sticky = true }: Props) {
  const pathname = usePathname()
  const config = PORTALES[portal]
  if (!config) return null

  const { color, secciones } = config
  const raiz = secciones[0].href

  return (
    <nav
      className={`z-20 shrink-0 border-b border-slate-100 bg-white/85 backdrop-blur-md ${
        sticky ? (top === 14 ? "sticky top-14" : "sticky top-16") : ""
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {secciones.map(({ href, label, icon: Icon }) => {
            // La raíz solo se marca con coincidencia exacta; el resto acepta
            // sus rutas hijas (ej. /prestamos/clientes/algo).
            const activo = href === raiz ? pathname === href : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activo ? "text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                style={activo ? { backgroundColor: color } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
