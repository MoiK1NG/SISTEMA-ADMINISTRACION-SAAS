import Link from "next/link"
import { ArrowLeft, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MenuManager } from "./_components/menu-manager"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { resolverAgente } from "@/lib/admin-context"

export default async function MenuPage() {
  // agenteId es el dueño de los datos que se muestran: el propio usuario, o
  // el cliente que un admin está inspeccionando en modo lectura.
  const { supabase, agenteId, viendoA } = await resolverAgente()

  const [{ data: itemsRaw }, { data: categoriasRaw }] = await Promise.all([
    supabase
      .from("menu_items_rest")
      .select("id, nombre, descripcion, precio, disponible, categoria_id, menu_categorias(nombre)")
      .eq("agente_id", agenteId)
      .order("nombre"),
    supabase
      .from("menu_categorias")
      .select("id, nombre, orden")
      .eq("agente_id", agenteId)
      .order("orden"),
  ])

  const items      = itemsRaw      ?? []
  const categorias = categoriasRaw ?? []

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/restaurante"><ArrowLeft className="h-4 w-4" />Mesas</Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <BookOpen className="h-5 w-5 text-red-600" />
          <p className="text-sm font-semibold text-slate-900">Menú</p>
          <div className="ml-auto text-[11px] text-slate-400">{items.length} platos · {categorias.length} categorías</div>
        </div>
      </header>
      <PortalNav portal="restaurante" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <MenuManager items={items as any} categorias={categorias as any} />
      </main>
    </div>
  )
}
