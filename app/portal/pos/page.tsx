// ─── Server Component ─────────────────────────────────────────────────────────
// Carga perfil + membresía en servidor. Los productos son mock hasta que
// se cree la tabla `productos` en Supabase (ver TODO abajo).

import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import { UtensilsCrossed } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PosShell } from "./_components/pos-shell"
import type { Producto } from "./types"

// ─── Catálogo de demo ─────────────────────────────────────────────────────────
// TODO: reemplazar con query real → supabase.from("productos").select(...)
const PRODUCTOS_MOCK: Producto[] = [
  // Panes
  { id: "p1",  nombre: "Pan de agua",         precio:  25,  categoria: "panes",   emoji: "🍞",  disponible: true  },
  { id: "p2",  nombre: "Pan sobao",            precio:  30,  categoria: "panes",   emoji: "🫓",  disponible: true  },
  { id: "p3",  nombre: "Pan de maíz",          precio:  35,  categoria: "panes",   emoji: "🌽",  disponible: true  },
  { id: "p4",  nombre: "Baguette",             precio:  80,  categoria: "panes",   emoji: "🥖",  disponible: true  },
  { id: "p5",  nombre: "Pan de hot dog",       precio:  40,  categoria: "panes",   emoji: "🌭",  disponible: true  },
  { id: "p6",  nombre: "Croissant",            precio:  95,  categoria: "panes",   emoji: "🥐",  disponible: true  },
  // Postres
  { id: "p7",  nombre: "Bizcocho de chocolate",precio: 150,  categoria: "postres", emoji: "🎂",  disponible: true  },
  { id: "p8",  nombre: "Galletas de vainilla", precio:  60,  categoria: "postres", emoji: "🍪",  disponible: true  },
  { id: "p9",  nombre: "Donut glaseado",       precio:  75,  categoria: "postres", emoji: "🍩",  disponible: true  },
  { id: "p10", nombre: "Cupcake",              precio:  90,  categoria: "postres", emoji: "🧁",  disponible: true  },
  { id: "p11", nombre: "Cheesecake",           precio: 180,  categoria: "postres", emoji: "🍰",  disponible: true  },
  { id: "p12", nombre: "Brownie",              precio:  85,  categoria: "postres", emoji: "🟫",  disponible: false },
  // Bebidas
  { id: "p13", nombre: "Café americano",       precio:  75,  categoria: "bebidas", emoji: "☕",  disponible: true  },
  { id: "p14", nombre: "Café con leche",       precio:  90,  categoria: "bebidas", emoji: "🥛",  disponible: true  },
  { id: "p15", nombre: "Jugo de naranja",      precio:  80,  categoria: "bebidas", emoji: "🍊",  disponible: true  },
  { id: "p16", nombre: "Agua fría",            precio:  30,  categoria: "bebidas", emoji: "💧",  disponible: true  },
  { id: "p17", nombre: "Té helado",            precio:  65,  categoria: "bebidas", emoji: "🧊",  disponible: true  },
  { id: "p18", nombre: "Batido de fresa",      precio: 120,  categoria: "bebidas", emoji: "🍓",  disponible: true  },
  // Salados
  { id: "p19", nombre: "Empanada de pollo",    precio:  70,  categoria: "salados", emoji: "🥟",  disponible: true  },
  { id: "p20", nombre: "Pastelito de carne",   precio:  60,  categoria: "salados", emoji: "🥐",  disponible: true  },
  { id: "p21", nombre: "Sandwich mixto",       precio: 140,  categoria: "salados", emoji: "🥪",  disponible: true  },
  { id: "p22", nombre: "Pizza personal",       precio: 220,  categoria: "salados", emoji: "🍕",  disponible: true  },
]

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

export default async function PosPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single()

  const { data: membership } = await supabase
    .from("memberships")
    .select("end_date, membership_plans(name)")
    .eq("user_id", user.id)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  // TODO: query real de productos
  // const { data: productosRaw } = await supabase
  //   .from("productos")
  //   .select("*")
  //   .eq("agente_id", user.id)
  //   .eq("disponible", true)
  //   .order("categoria, nombre")
  const productos: Producto[] = PRODUCTOS_MOCK.filter(p => p.disponible)

  const planName = (membership?.membership_plans as any)?.name ?? "Plan Activo"
  const initials = profile?.full_name ? getInitials(profile.full_name) : "U"

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-100 bg-white/90 backdrop-blur-sm px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between max-w-[1600px] mx-auto">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm shadow-amber-500/30">
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-none text-slate-900">Punto de Venta</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Restaurante / Panadería</p>
            </div>
          </div>

          {/* Centro: fecha y hora */}
          <div className="hidden md:block text-center">
            <p className="text-sm font-semibold text-slate-700">
              {new Intl.DateTimeFormat("es-CO", {
                weekday: "long", day: "numeric", month: "long"
              }).format(new Date())}
            </p>
          </div>

          {/* Derecha: membresía + avatar */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700">{planName}</span>
            </div>
            <Avatar className="h-7 w-7 ring-2 ring-slate-100">
              <AvatarFallback className="bg-amber-500/10 text-amber-700 text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* ── POS SHELL (Client Component con todo el estado) ──────────────── */}
      <div className="flex-1 overflow-hidden p-3 sm:p-4 max-w-[1600px] w-full mx-auto">
        <PosShell productos={productos} />
      </div>
    </div>
  )
}
