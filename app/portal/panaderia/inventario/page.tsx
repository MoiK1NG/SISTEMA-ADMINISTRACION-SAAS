import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Box } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InventarioManager } from "./_components/inventario-manager"
import { PortalNav } from "@/components/portal/portal-nav"

export default async function InventarioPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data } = await supabase
    .from("insumos_pan")
    .select("id, nombre, unidad, stock_actual, stock_minimo, precio_unidad")
    .eq("agente_id", user.id)
    .order("nombre")

  const insumos = data ?? []
  const alertas = insumos.filter(i => i.stock_actual <= i.stock_minimo).length

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/panaderia"><ArrowLeft className="h-4 w-4" />Panel</Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <Box className="h-5 w-5 text-orange-500" />
          <p className="text-sm font-semibold text-slate-900">Inventario</p>
          {alertas > 0 && (
            <span className="ml-1 rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              {alertas} alertas
            </span>
          )}
          <div className="ml-auto text-[11px] text-slate-400">{insumos.length} insumos</div>
        </div>
      </header>
      <PortalNav portal="panaderia" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <InventarioManager insumos={insumos as any} />
      </main>
    </div>
  )
}
