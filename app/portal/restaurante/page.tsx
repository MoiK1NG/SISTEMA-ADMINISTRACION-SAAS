import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { UtensilsCrossed, Users, BookOpen, ReceiptText, Plus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MesaCard } from "./_components/mesa-card"

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export default async function RestaurantePage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single()
  const { data: membership } = await supabase.from("memberships").select("end_date, membership_plans(name)")
    .eq("user_id", user.id).gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: false }).limit(1).maybeSingle()

  const today = new Date().toISOString().split("T")[0]

  const [
    { data: mesasRaw },
    { data: ordenesAbiertasRaw },
    { data: ventasHoyRaw },
    { data: menuItemsCount },
  ] = await Promise.all([
    supabase.from("mesas_rest").select("id, numero, capacidad, estado").eq("agente_id", user.id).order("numero"),
    supabase.from("ordenes_rest").select("id, mesa_id, total, created_at").eq("agente_id", user.id).eq("estado", "abierta"),
    supabase.from("pagos_rest").select("monto, created_at").eq("agente_id", user.id).gte("created_at", today),
    supabase.from("menu_items_rest").select("id", { count: "exact", head: true }).eq("agente_id", user.id).eq("disponible", true),
  ])

  const mesas = mesasRaw ?? []
  const ordenesAbiertas = ordenesAbiertasRaw ?? []
  const totalVentasHoy  = (ventasHoyRaw ?? []).reduce((s, p) => s + Number(p.monto), 0)

  // Mapa mesa_id → orden abierta
  const ordenPorMesa = new Map(ordenesAbiertas.map(o => [o.mesa_id, o]))

  const mesasLibres   = mesas.filter(m => m.estado === "libre").length
  const mesasOcupadas = mesas.filter(m => m.estado === "ocupada").length

  const planName = (membership?.membership_plans as any)?.name ?? "Plan Activo"
  const hora     = new Date().getHours()
  const saludo   = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches"

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 shadow-sm shadow-red-500/30">
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none text-slate-900">Restaurante</p>
              <p className="mt-0.5 text-xs text-slate-500">Gestión de mesas y órdenes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-slate-600">
              <Link href="/portal/restaurante/menu"><BookOpen className="h-4 w-4" />Menú</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-slate-600">
              <Link href="/portal/restaurante/caja"><ReceiptText className="h-4 w-4" />Caja</Link>
            </Button>
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-700">{planName}</span>
            </div>
            <Avatar className="h-8 w-8 ring-2 ring-slate-100 ml-1">
              <AvatarFallback className="bg-red-600/10 text-red-700 text-xs font-semibold">{getInitials(profile?.full_name ?? "U")}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{saludo}, {profile?.full_name?.split(" ")[0] ?? "bienvenido"}</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mapa de Mesas</h1>
          </div>
          <Button asChild className="bg-red-600 hover:bg-red-700 gap-2 shadow-lg shadow-red-500/20">
            <Link href="/portal/restaurante/configuracion"><Plus className="h-4 w-4" />Gestionar mesas</Link>
          </Button>
        </div>

        {/* KPIs rápidos */}
        <section className="grid gap-4 sm:grid-cols-4">
          {[
            { label:"Mesas libres",  value: String(mesasLibres),           color:"text-emerald-600", bg:"bg-emerald-50"  },
            { label:"Mesas ocupadas",value: String(mesasOcupadas),         color:"text-red-600",     bg:"bg-red-50"      },
            { label:"Órdenes abiertas",value:String(ordenesAbiertas.length),color:"text-amber-600",  bg:"bg-amber-50"    },
            { label:"Ventas hoy",    value: fmt(totalVentasHoy),           color:"text-blue-600",    bg:"bg-blue-50"     },
          ].map(k => (
            <Card key={k.label} className="border-slate-100 bg-white shadow-sm">
              <CardContent className="pt-4 flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${k.bg}`}>
                  <span className={`text-lg font-bold ${k.color}`}>{k.value}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Mapa de mesas */}
        {mesas.length === 0 ? (
          <Card className="border-dashed border-slate-200">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <UtensilsCrossed className="h-12 w-12 text-slate-200 mb-4" />
              <p className="text-lg font-semibold text-slate-700">Sin mesas configuradas</p>
              <p className="text-sm text-slate-400 mt-1 mb-4">Configura las mesas de tu restaurante para empezar a tomar órdenes.</p>
              <Button asChild className="bg-red-600 hover:bg-red-700">
                <Link href="/portal/restaurante/configuracion">Configurar mesas</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {mesas.map((mesa) => (
              <MesaCard
                key={mesa.id}
                mesa={mesa}
                ordenAbierta={ordenPorMesa.get(mesa.id) ?? null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
