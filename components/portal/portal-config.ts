import {
  LayoutDashboard, ClipboardList, ShoppingCart, Boxes, Package,
  Users, Receipt, UtensilsCrossed, Settings, Grid2x2, Banknote,
  Calculator, Truck, Wallet,
} from "lucide-react"

export interface Seccion {
  href:  string
  label: string
  icon:  React.ComponentType<{ className?: string }>
}

/** Secciones de cada portal. La primera es siempre la raíz del portal. */
export const PORTALES: Record<string, { nombre: string; color: string; secciones: Seccion[] }> = {
  farmacia: {
    nombre: "Farmacia",
    color: "#0d9488",
    secciones: [
      { href: "/portal/farmacia",            label: "Panel",      icon: LayoutDashboard },
      { href: "/portal/farmacia/pos",        label: "Vender",     icon: Grid2x2         },
      { href: "/portal/farmacia/ventas",     label: "Ventas",     icon: Receipt         },
      { href: "/portal/farmacia/pedidos",    label: "Pedidos",    icon: ClipboardList   },
      { href: "/portal/farmacia/inventario", label: "Inventario", icon: Boxes           },
      { href: "/portal/farmacia/caja",       label: "Cierre",     icon: Calculator      },
      { href: "/portal/farmacia/compras",    label: "Compras",    icon: Truck           },
      { href: "/portal/farmacia/finanzas",   label: "Finanzas",   icon: Wallet          },
      { href: "/portal/farmacia/equipo",     label: "Equipo",     icon: Users           },
    ],
  },
  panaderia: {
    nombre: "Panadería",
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
    nombre: "Punto de Venta",
    color: "#8b5cf6",
    secciones: [
      { href: "/portal/pos",           label: "Caja",      icon: Grid2x2 },
      { href: "/portal/pos/productos", label: "Productos", icon: Package },
      { href: "/portal/pos/ventas",    label: "Ventas",    icon: Receipt },
    ],
  },
  prestamos: {
    nombre: "Préstamos",
    color: "#1d4ed8",
    secciones: [
      { href: "/portal/prestamos",          label: "Cartera",  icon: LayoutDashboard },
      { href: "/portal/prestamos/clientes", label: "Clientes", icon: Users           },
    ],
  },
  canchas: {
    nombre: "Canchas Sintéticas",
    color: "#10b981",
    secciones: [
      { href: "/portal/canchas", label: "Agenda", icon: LayoutDashboard },
    ],
  },
  cobros: {
    nombre: "Cobros",
    color: "#10b981",
    secciones: [
      { href: "/portal/cobros",          label: "Cobros",   icon: Banknote },
      { href: "/portal/cobros/clientes", label: "Clientes", icon: Users    },
    ],
  },
  restaurante: {
    nombre: "Restaurante",
    color: "#ef4444",
    secciones: [
      { href: "/portal/restaurante",               label: "Mesas",   icon: LayoutDashboard },
      { href: "/portal/restaurante/menu",          label: "Menú",    icon: UtensilsCrossed },
      { href: "/portal/restaurante/caja",          label: "Caja",    icon: Receipt         },
      { href: "/portal/restaurante/configuracion", label: "Ajustes", icon: Settings        },
    ],
  },
}
