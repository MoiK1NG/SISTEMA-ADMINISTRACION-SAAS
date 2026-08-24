import Link from "next/link"
import { ArrowLeft, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductosManager } from "./_components/productos-manager"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { resolverAgente } from "@/lib/admin-context"

export default async function ProductosPage() {
  // agenteId es el dueño de los datos que se muestran: el propio usuario, o
  // el cliente que un admin está inspeccionando en modo lectura.
  const { supabase, agenteId, viendoA } = await resolverAgente()

  const { data } = await supabase
    .from("productos_pan")
    .select("id, nombre, categoria, precio_venta, costo_produccion, unidad, activo")
    .eq("agente_id", agenteId)
    .order("nombre")

  const productos = data ?? []

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/panaderia"><ArrowLeft className="h-4 w-4" />Panel</Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <Package className="h-5 w-5 text-orange-500" />
          <p className="text-sm font-semibold text-slate-900">Catálogo de Productos</p>
          <div className="ml-auto text-[11px] text-slate-400">{productos.length} productos</div>
        </div>
      </header>
      <PortalNav portal="panaderia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ProductosManager productos={productos as any} />
      </main>
    </div>
  )
}
