import Link from "next/link"
import { ArrowLeft, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductosPosManager } from "./_components/productos-pos-manager"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { resolverAgente } from "@/lib/admin-context"

export default async function ProductosPosPage() {
  // agenteId es el dueño de los datos que se muestran: el propio usuario, o
  // el cliente que un admin está inspeccionando en modo lectura.
  const { supabase, agenteId, viendoA } = await resolverAgente()

  const { data: productosRaw } = await supabase
    .from("productos_pos")
    .select("id, nombre, categoria, emoji, precio, disponible")
    .eq("agente_id", agenteId)
    .order("categoria")
    .order("nombre")

  const productos = (productosRaw ?? []).map((p: any) => ({ ...p, precio: Number(p.precio) }))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <Link href="/portal/pos"><ArrowLeft className="h-3.5 w-3.5" />Volver al POS</Link>
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <Package className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold text-slate-900">Catálogo de productos</p>
            </div>
          </div>
        </div>
      </header>
      <PortalNav portal="pos" top={14} />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ProductosPosManager productos={productos} />
      </main>
    </div>
  )
}
