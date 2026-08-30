import { ClipboardList } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { PedidosFarmacia, type FilaPedido, type ClientePedido } from "./_components/pedidos-farmacia"

export default async function PedidosFarmaciaPage() {
  const { supabase, viendoA, negocio, rol } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  const [{ data: pedidosRaw }, { data: clientes }] = await Promise.all([
    supabase.from("pedidos_farmacia")
      .select(`id, descripcion, cantidad, total, monto_pagado, metodo_pago, estado, notas, created_at,
        clientes_farmacia(nombre, telefono)`)
      .eq("negocio_id", negocio.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("clientes_farmacia")
      .select("id, nombre, cedula, telefono")
      .eq("negocio_id", negocio.id)
      .order("nombre"),
  ])

  const pedidos: FilaPedido[] = (pedidosRaw ?? []).map((p: any) => {
    const cli = Array.isArray(p.clientes_farmacia) ? p.clientes_farmacia[0] : p.clientes_farmacia
    return {
      id:          p.id,
      descripcion: p.descripcion,
      cantidad:    Number(p.cantidad),
      total:       Number(p.total),
      pagado:      Number(p.monto_pagado),
      metodo:      p.metodo_pago,
      estado:      p.estado,
      notas:       p.notas,
      creada:      p.created_at,
      cliente:     cli?.nombre ?? "—",
      telefono:    cli?.telefono ?? null,
    }
  })

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Pedidos pendientes</p>
            <p className="mt-0.5 text-xs text-slate-500">Encargos pagados sin stock · {negocio.nombre}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PedidosFarmacia
          pedidos={pedidos}
          clientes={(clientes ?? []) as ClientePedido[]}
          esGestor={(rol === "dueno" || rol === "regente") && !viendoA}
          soloLectura={Boolean(viendoA)}
          nombreNegocio={negocio.nombre}
        />
      </main>
    </div>
  )
}
