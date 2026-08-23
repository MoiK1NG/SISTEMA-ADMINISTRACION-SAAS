import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChefHat, ClipboardList, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { OrdenProduccionCard } from "./_components/orden-produccion-card"
import { NuevaOrdenButton } from "./_components/nueva-orden-button"
import { PortalNav } from "@/components/portal/portal-nav"

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { weekday:"long", day:"2-digit", month:"long" }).format(new Date(iso + "T00:00:00"))
}

const ESTADO_ORDEN: Record<string, { label: string; variant: any }> = {
  pendiente:   { label: "Pendiente",   variant: "warning"   },
  en_proceso:  { label: "En proceso",  variant: "default"   },
  completada:  { label: "Completada",  variant: "success"   },
  cancelada:   { label: "Cancelada",   variant: "secondary" },
}

export default async function ProduccionPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: productosRaw } = await supabase
    .from("productos_pan").select("id, nombre, categoria").eq("agente_id", user.id).eq("activo", true).order("nombre")

  const { data: ordenesRaw } = await supabase
    .from("ordenes_produccion")
    .select("id, fecha, estado, notas, items_produccion(id, cantidad_plan, cantidad_real, productos_pan(nombre))")
    .eq("agente_id", user.id)
    .order("fecha", { ascending: false })
    .limit(20)

  const ordenes  = ordenesRaw ?? []
  const productos = productosRaw ?? []
  const today    = new Date().toISOString().split("T")[0]
  const ordenHoy = ordenes.find(o => o.fecha === today)

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/panaderia"><ArrowLeft className="h-4 w-4" />Panel</Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <ClipboardList className="h-5 w-5 text-orange-500" />
          <p className="text-sm font-semibold text-slate-900">Órdenes de Producción</p>
          <div className="ml-auto">
            <NuevaOrdenButton productos={productos as any} />
          </div>
        </div>
      </header>
      <PortalNav portal="panaderia" />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {!ordenHoy && (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="flex items-center gap-4 pt-5">
              <ChefHat className="h-8 w-8 text-orange-500 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-orange-800">Sin orden para hoy</p>
                <p className="text-sm text-orange-600">Crea la orden de producción del día para empezar.</p>
              </div>
              <NuevaOrdenButton productos={productos as any} forToday />
            </CardContent>
          </Card>
        )}

        {ordenes.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-slate-200 mb-4" />
            <p className="text-lg font-semibold text-slate-700">Sin órdenes aún</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ordenes.map(orden => (
              <OrdenProduccionCard key={orden.id} orden={orden as any} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
