import { Truck } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { ComprasFarmacia, type FilaCuenta } from "./_components/compras-farmacia"

export default async function ComprasFarmaciaPage() {
  const { supabase, viendoA, negocio, rol } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  // Cuentas por pagar = compras: territorio de dueño y regente (el cajero no)
  const esGestor = rol === "dueno" || rol === "regente"
  if (!esGestor) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <p className="text-3xl">🔒</p>
          <p className="mt-3 text-sm font-bold text-slate-900">Sección de compras</p>
          <p className="mt-1 text-sm text-slate-500">
            Las cuentas por pagar a proveedores las gestionan el dueño y el regente.
          </p>
        </div>
      </div>
    )
  }

  const [{ data: cuentasRaw }, { data: proveedores }] = await Promise.all([
    supabase.from("cuentas_pagar_farmacia")
      .select("id, concepto, monto_total, monto_pagado, fecha_vencimiento, estado, notas, created_at, proveedores_farmacia(nombre)")
      .eq("negocio_id", negocio.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("proveedores_farmacia")
      .select("id, nombre").eq("negocio_id", negocio.id).eq("activo", true).order("nombre"),
  ])

  const cuentas: FilaCuenta[] = (cuentasRaw ?? []).map((c: any) => {
    const prov = Array.isArray(c.proveedores_farmacia) ? c.proveedores_farmacia[0] : c.proveedores_farmacia
    return {
      id:          c.id,
      concepto:    c.concepto,
      proveedor:   prov?.nombre ?? null,
      total:       Number(c.monto_total),
      pagado:      Number(c.monto_pagado),
      vence:       c.fecha_vencimiento,
      estado:      c.estado,
      notas:       c.notas,
      creada:      c.created_at,
    }
  })

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <Truck className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Compras · Cuentas por pagar</p>
            <p className="mt-0.5 text-xs text-slate-500">{negocio.nombre}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ComprasFarmacia
          cuentas={cuentas}
          proveedores={(proveedores ?? []) as { id: string; nombre: string }[]}
          esDueno={rol === "dueno"}
          soloLectura={Boolean(viendoA)}
        />
      </main>
    </div>
  )
}
