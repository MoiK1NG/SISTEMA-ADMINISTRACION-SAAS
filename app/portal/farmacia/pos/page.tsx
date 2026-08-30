import { Grid2x2 } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { PosFarmacia, type ProductoPos, type ClientePos } from "./_components/pos-farmacia"

export default async function PosFarmaciaPage() {
  const { supabase, viendoA, negocio } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  const [{ data: productosRaw }, { data: stockRaw }, { data: clientesRaw }] = await Promise.all([
    supabase.from("productos_farmacia")
      .select("id, codigo_barras, nombre, principio_activo, concentracion, presentacion, precio_venta, requiere_receta")
      .eq("negocio_id", negocio.id).eq("activo", true)
      .order("nombre"),
    supabase.from("stock_farmacia")
      .select("producto_id, stock_venta")
      .eq("negocio_id", negocio.id),
    supabase.from("clientes_farmacia")
      .select("id, nombre, cedula, telefono")
      .eq("negocio_id", negocio.id)
      .order("nombre"),
  ])

  const stockPorId = new Map((stockRaw ?? []).map((s: any) => [s.producto_id, Number(s.stock_venta)]))

  const productos: ProductoPos[] = (productosRaw ?? []).map((p: any) => ({
    id:               p.id,
    codigo_barras:    p.codigo_barras,
    nombre:           p.nombre,
    principio_activo: p.principio_activo,
    concentracion:    p.concentracion,
    presentacion:     p.presentacion,
    precio:           Number(p.precio_venta),
    requiere_receta:  p.requiere_receta,
    stock:            stockPorId.get(p.id) ?? 0,
  }))

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <Grid2x2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Caja</p>
            <p className="mt-0.5 text-xs text-slate-500">{negocio.nombre}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <PosFarmacia
          productos={productos}
          clientes={(clientesRaw ?? []) as ClientePos[]}
          soloLectura={Boolean(viendoA)}
        />
      </main>
    </div>
  )
}
