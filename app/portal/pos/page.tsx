// ─── Server Component ─────────────────────────────────────────────────────────
// Carga perfil, membresía, catálogo real y KPI de ventas del día.

import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { UtensilsCrossed, Package, Receipt, Plus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PosShell } from "./_components/pos-shell"
import type { Producto } from "./types"
import { PortalNav } from "@/components/portal/portal-nav"

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
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

  // ── Catálogo real ─────────────────────────────────────────────────────────
  const { data: productosRaw } = await supabase
    .from("productos_pos")
    .select("id, nombre, precio, categoria, emoji, disponible")
    .eq("agente_id", user.id)
    .eq("disponible", true)
    .order("categoria")
    .order("nombre")

  const productos: Producto[] = (productosRaw ?? []).map((p: any) => ({
    ...p,
    precio: Number(p.precio),
  }))

  // ── KPI: ventas de hoy ────────────────────────────────────────────────────
  const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0)
  const { data: ventasHoy } = await supabase
    .from("ventas_pos")
    .select("total")
    .eq("agente_id", user.id)
    .gte("created_at", hoyInicio.toISOString())

  const numVentasHoy   = ventasHoy?.length ?? 0
  const totalVentasHoy = (ventasHoy ?? []).reduce((s, v) => s + Number(v.total), 0)

  const planName = (membership?.membership_plans as any)?.name ?? "Plan Activo"
  const initials = profile?.full_name ? getInitials(profile.full_name) : "U"

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-100 bg-white/90 backdrop-blur-sm px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between max-w-[1600px] mx-auto">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shadow-violet-500/30">
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-none text-slate-900">Punto de Venta</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Ventas de mostrador</p>
            </div>
          </div>

          {/* Centro: KPI del día */}
          <div className="flex items-center gap-2">
            {numVentasHoy > 0 && (
              <div className="hidden md:flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1">
                <span className="text-xs font-semibold text-violet-700">
                  Hoy: {numVentasHoy} {numVentasHoy === 1 ? "venta" : "ventas"} · {fmt(totalVentasHoy)}
                </span>
              </div>
            )}
          </div>

          {/* Derecha: membresía + avatar */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700">{planName}</span>
            </div>
            <Avatar className="h-7 w-7 ring-2 ring-slate-100">
              <AvatarFallback className="bg-violet-500/10 text-violet-700 text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>
      <PortalNav portal="pos" top={14} sticky={false} />

      {/* ── POS SHELL o estado vacío ──────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-3 sm:p-4 max-w-[1600px] w-full mx-auto">
        {productos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white text-center px-6">
            <p className="text-5xl mb-4">🛒</p>
            <p className="text-base font-bold text-slate-900">Tu catálogo está vacío</p>
            <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
              Agrega tus productos con nombre, precio y categoría para empezar a vender.
            </p>
            <Button asChild className="mt-5 gap-1.5 bg-violet-600 hover:bg-violet-700">
              <Link href="/portal/pos/productos"><Plus className="h-4 w-4" />Agregar productos</Link>
            </Button>
          </div>
        ) : (
          <PosShell productos={productos} />
        )}
      </div>
    </div>
  )
}
