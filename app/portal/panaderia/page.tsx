import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChefHat, Package, ShoppingCart, TrendingUp, AlertTriangle, ClipboardList, BarChart3, Boxes } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PortalNav } from "@/components/portal/portal-nav"

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(new Date(iso))
}
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export default async function PanaderiaPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single()
  const { data: membership } = await supabase.from("memberships").select("end_date, membership_plans(name)")
    .eq("user_id", user.id).gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: false }).limit(1).maybeSingle()

  const today = new Date().toISOString().split("T")[0]

  const [
    { data: productosRaw },
    { data: insumosRaw },
    { data: ordenHoyRaw },
    { data: ventasHoyRaw },
    { data: ventas7Raw },
  ] = await Promise.all([
    supabase.from("productos_pan").select("id, nombre, categoria, precio_venta, activo").eq("agente_id", user.id).eq("activo", true),
    supabase.from("insumos_pan").select("id, nombre, unidad, stock_actual, stock_minimo").eq("agente_id", user.id),
    supabase.from("ordenes_produccion").select("id, estado, items_produccion(producto_id, cantidad_plan, cantidad_real, productos_pan(nombre))")
      .eq("agente_id", user.id).eq("fecha", today).limit(1).maybeSingle(),
    supabase.from("ventas_pan").select("id, total, items_venta_pan(cantidad, precio_unitario, subtotal)").eq("agente_id", user.id).eq("fecha", today),
    supabase.from("ventas_pan").select("fecha, total").eq("agente_id", user.id)
      .gte("fecha", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]).order("fecha", { ascending: false }),
  ])

  const totalVentasHoy  = (ventasHoyRaw ?? []).reduce((s, v) => s + Number(v.total), 0)
  const totalVentas7    = (ventas7Raw ?? []).reduce((s, v) => s + Number(v.total), 0)
  const insumosConAlerta = (insumosRaw ?? []).filter(i => Number(i.stock_actual) <= Number(i.stock_minimo))
  const productosTotales = (productosRaw ?? []).length

  const ordenHoy = ordenHoyRaw as any
  const itemsOrden = ordenHoy?.items_produccion ?? []
  const totalPlanificado = itemsOrden.reduce((s: number, i: any) => s + i.cantidad_plan, 0)
  const totalProducido   = itemsOrden.reduce((s: number, i: any) => s + i.cantidad_real, 0)

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches"
  const planName = (membership?.membership_plans as any)?.name ?? "Plan Activo"

  // Tarjetas grandes del final del panel. La navegación entre secciones vive
  // en <PortalNav>; esto es un atajo visual, no el menú.
  const accesosRapidos = [
    { href: "/portal/panaderia/produccion", label: "Producción",  icon: ClipboardList },
    { href: "/portal/panaderia/ventas",     label: "Ventas",      icon: ShoppingCart  },
    { href: "/portal/panaderia/inventario", label: "Inventario",  icon: Boxes         },
    { href: "/portal/panaderia/productos",  label: "Productos",   icon: Package       },
  ]

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-sm shadow-orange-500/30">
              <ChefHat className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none text-slate-900">Panadería</p>
              <p className="mt-0.5 text-xs text-slate-500">Portal de gestión</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 ml-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-xs font-medium text-orange-700">{planName}</span>
            </div>
            <Avatar className="h-8 w-8 ring-2 ring-slate-100 ml-1">
              <AvatarFallback className="bg-orange-500/10 text-orange-700 text-xs font-semibold">{getInitials(profile?.full_name ?? "U")}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>
      <PortalNav portal="panaderia" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div>
          <p className="text-sm text-slate-500">{saludo}, {profile?.full_name?.split(" ")[0] ?? "bienvenido"}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Panel de Panadería</h1>
        </div>

        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label:"Ventas hoy",       value: fmt(totalVentasHoy), sub:`${ventasHoyRaw?.length ?? 0} transacciones`,   icon:ShoppingCart, bg:"bg-emerald-50",  color:"text-emerald-600" },
            { label:"Ventas 7 días",    value: fmt(totalVentas7),   sub:"Últimos 7 días",                               icon:TrendingUp,   bg:"bg-blue-50",     color:"text-blue-600"    },
            { label:"Productos activos",value: String(productosTotales), sub:"En catálogo",                            icon:Package,      bg:"bg-amber-50",    color:"text-amber-600"   },
            { label:"Alertas stock",    value: String(insumosConAlerta.length), sub: insumosConAlerta.length > 0 ? "Insumos bajo mínimo" : "Sin alertas",
              icon:AlertTriangle, bg: insumosConAlerta.length > 0 ? "bg-rose-50" : "bg-slate-50",
              color: insumosConAlerta.length > 0 ? "text-rose-600" : "text-slate-400" },
          ].map(k => (
            <Card key={k.label} className="group border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">{k.label}</CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${k.bg}`}><k.icon className={`h-4 w-4 ${k.color}`} /></div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                <p className="mt-1 text-xs text-slate-500">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Producción del día */}
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-4">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-orange-500" /> Producción de hoy
              </CardTitle>
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                <Link href="/portal/panaderia/produccion">Ver detalle</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {!ordenHoy ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <ClipboardList className="h-8 w-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-500">Sin orden de producción para hoy</p>
                  <Button asChild size="sm" className="mt-3 bg-orange-500 hover:bg-orange-600">
                    <Link href="/portal/panaderia/produccion">Crear orden</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Total planificado</span>
                    <span className="font-semibold">{totalProducido} / {totalPlanificado} unidades</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${totalPlanificado > 0 ? Math.round((totalProducido/totalPlanificado)*100) : 0}%` }} />
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {itemsOrden.slice(0,4).map((item: any) => (
                      <div key={item.producto_id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700">{item.productos_pan?.nombre ?? "Producto"}</span>
                        <span className={item.cantidad_real >= item.cantidad_plan ? "text-emerald-600 font-medium" : "text-slate-500"}>
                          {item.cantidad_real}/{item.cantidad_plan}
                        </span>
                      </div>
                    ))}
                    {itemsOrden.length > 4 && <p className="text-xs text-slate-400">+{itemsOrden.length - 4} más…</p>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ventas recientes */}
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-4">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-500" /> Ventas últimos 7 días
              </CardTitle>
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link href="/portal/panaderia/ventas">Registrar venta</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {(ventas7Raw ?? []).length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <ShoppingCart className="h-8 w-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-500">Sin ventas en los últimos 7 días</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(ventas7Raw ?? []).slice(0, 7).map((v) => (
                    <div key={v.fecha} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{fmtDate(v.fecha)}</span>
                      <span className="font-semibold text-emerald-700">{fmt(Number(v.total))}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas de stock */}
        {insumosConAlerta.length > 0 && (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Insumos con stock bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {insumosConAlerta.map(i => (
                  <div key={i.id} className="flex items-center justify-between rounded-lg bg-white border border-rose-100 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{i.nombre}</p>
                      <p className="text-xs text-rose-600">Stock: {Number(i.stock_actual).toFixed(2)} {i.unidad}</p>
                    </div>
                    <Badge variant="destructive" className="text-[10px]">Bajo</Badge>
                  </div>
                ))}
              </div>
              <Button asChild variant="link" size="sm" className="mt-2 text-rose-600 px-0">
                <Link href="/portal/panaderia/inventario">Gestionar inventario →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Accesos rápidos */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {accesosRapidos.map(l => (
            <Link key={l.href} href={l.href} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <l.icon className="h-5 w-5 text-orange-500" />
              </div>
              <span className="text-sm font-medium text-slate-800">{l.label}</span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  )
}
