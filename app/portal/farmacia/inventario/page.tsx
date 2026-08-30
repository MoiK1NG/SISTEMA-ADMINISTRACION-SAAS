import { Boxes } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { estadoCaducidad } from "@/lib/farmacia/caducidad"
import { InventarioFarmacia, type FilaProducto, type CatalogoItem } from "./_components/inventario-farmacia"

export default async function InventarioFarmaciaPage() {
  const { supabase, viendoA, negocio, rol } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  const [
    { data: productosRaw },
    { data: stockRaw },
    { data: proveedores },
    { data: laboratorios },
  ] = await Promise.all([
    supabase.from("productos_farmacia")
      .select("id, codigo_barras, nombre, principio_activo, concentracion, presentacion, categoria, registro_invima, precio_venta, costo, requiere_receta, activo, laboratorio_id, proveedor_id")
      .eq("negocio_id", negocio.id)
      .order("nombre"),
    supabase.from("stock_farmacia")
      .select("producto_id, stock_venta, stock_bodega, proximo_vencimiento")
      .eq("negocio_id", negocio.id),
    supabase.from("proveedores_farmacia")
      .select("id, nombre").eq("negocio_id", negocio.id).eq("activo", true).order("nombre"),
    supabase.from("laboratorios_farmacia")
      .select("id, nombre").eq("negocio_id", negocio.id).order("nombre"),
  ])

  const stockPorProducto = new Map(
    (stockRaw ?? []).map((s: any) => [s.producto_id, s])
  )

  const esGestor = rol === "dueno" || rol === "regente"

  const filas: FilaProducto[] = (productosRaw ?? []).map((p: any) => {
    const s = stockPorProducto.get(p.id)
    const vence = s?.proximo_vencimiento ?? null
    return {
      id:               p.id,
      codigo_barras:    p.codigo_barras,
      nombre:           p.nombre,
      principio_activo: p.principio_activo,
      concentracion:    p.concentracion,
      presentacion:     p.presentacion,
      categoria:        p.categoria,
      registro_invima:  p.registro_invima,
      precio_venta:     Number(p.precio_venta),
      // El costo y el margen son información del dueño/regente, no del cajero
      costo:            esGestor ? Number(p.costo) : null,
      requiere_receta:  p.requiere_receta,
      activo:           p.activo,
      laboratorio_id:   p.laboratorio_id,
      proveedor_id:     p.proveedor_id,
      stock_venta:      Number(s?.stock_venta ?? 0),
      stock_bodega:     Number(s?.stock_bodega ?? 0),
      vence,
      semaforo:         estadoCaducidad(vence),
    }
  })

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Inventario</p>
            <p className="mt-0.5 text-xs text-slate-500">{negocio.nombre}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <InventarioFarmacia
          filas={filas}
          proveedores={(proveedores ?? []) as CatalogoItem[]}
          laboratorios={(laboratorios ?? []) as CatalogoItem[]}
          esGestor={esGestor && !viendoA}
        />
      </main>
    </div>
  )
}
