import { Receipt } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { fechaHoy, sumarDias, diferenciaDias, inicioDiaISO, finDiaISO } from "@/lib/farmacia/formato"
import { VentasFarmacia, type FilaVenta, type FilaEncargo } from "./_components/ventas-farmacia"

/** Más filas que esto por rango no se muestran: se avisa y se pide acotar las fechas. */
const LIMITE = 500
const DIAS_POR_DEFECTO = 7
const MAX_DIAS = 366

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Rango pedido en la URL, saneado: por defecto los últimos 7 días; nunca más de un año. */
function rangoValido(desde: string | undefined, hasta: string | undefined, hoy: string) {
  let d = desde && FECHA_RE.test(desde) ? desde : sumarDias(hoy, -(DIAS_POR_DEFECTO - 1))
  let h = hasta && FECHA_RE.test(hasta) ? hasta : hoy
  if (d > h) [d, h] = [h, d]
  if (diferenciaDias(h, d) > MAX_DIAS) d = sumarDias(h, -MAX_DIAS)
  return { desde: d, hasta: h }
}

export default async function VentasFarmaciaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const { supabase, viendoA, negocio, rol } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#F7F9FC]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  const sp    = await searchParams
  const hoy   = fechaHoy(negocio.moneda)
  const rango = rangoValido(sp.desde, sp.hasta, hoy)
  // Los límites del día se calculan en la zona horaria del negocio, no en UTC
  const desdeISO = inicioDiaISO(rango.desde, negocio.moneda)
  const hastaISO = finDiaISO(rango.hasta, negocio.moneda)

  const [{ data: ventasRaw }, { data: encargosRaw }] = await Promise.all([
    supabase
      .from("ventas_farmacia")
      .select(`id, numero, total, estado, created_at, anulada_motivo,
        clientes_farmacia(nombre),
        items_venta_farmacia(nombre, cantidad, precio_unitario),
        pagos_venta_farmacia(metodo, monto)`)
      .eq("negocio_id", negocio.id)
      .gte("created_at", desdeISO)
      .lte("created_at", hastaISO)
      .order("created_at", { ascending: false })
      .limit(LIMITE),
    supabase
      .from("pedidos_farmacia")
      .select(`id, descripcion, cantidad, total, monto_pagado, estado, created_at,
        clientes_farmacia(nombre),
        pagos_pedido_farmacia(metodo, monto, created_at)`)
      .eq("negocio_id", negocio.id)
      .gte("created_at", desdeISO)
      .lte("created_at", hastaISO)
      .order("created_at", { ascending: false })
      .limit(LIMITE),
  ])

  const encargos: FilaEncargo[] = (encargosRaw ?? []).map((p: any) => {
    const cli = Array.isArray(p.clientes_farmacia) ? p.clientes_farmacia[0] : p.clientes_farmacia
    return {
      id:          p.id,
      descripcion: p.descripcion,
      cantidad:    Number(p.cantidad),
      total:       Number(p.total),
      pagado:      Number(p.monto_pagado),
      estado:      p.estado,
      creada:      p.created_at,
      cliente:     cli?.nombre ?? "—",
      pagos:       (p.pagos_pedido_farmacia ?? []).map((pg: any) => ({
        metodo: pg.metodo, monto: Number(pg.monto), fecha: pg.created_at,
      })),
    }
  })

  const ventas: FilaVenta[] = (ventasRaw ?? []).map((v: any) => {
    const cli = Array.isArray(v.clientes_farmacia) ? v.clientes_farmacia[0] : v.clientes_farmacia
    const lineas = (v.items_venta_farmacia ?? []).map((i: any) => ({
      nombre: i.nombre as string, cantidad: Number(i.cantidad), precio: Number(i.precio_unitario),
    }))
    return {
      id:      v.id,
      numero:  v.numero,
      total:   Number(v.total),
      estado:  v.estado,
      creada:  v.created_at,
      cliente: cli?.nombre ?? null,
      motivo_anulacion: v.anulada_motivo,
      items:   lineas.map((l: { nombre: string; cantidad: number }) => `${l.cantidad}× ${l.nombre}`),
      lineas,
      pagos:   (v.pagos_venta_farmacia ?? []).map((p: any) => ({ metodo: p.metodo, monto: Number(p.monto) })),
    }
  })

  const esGestor = (rol === "dueno" || rol === "regente") && !viendoA

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 shadow-sm shadow-brand-500/30">
            <Receipt className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Ventas</p>
            <p className="mt-0.5 text-xs text-slate-500">{negocio.nombre}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <VentasFarmacia
          ventas={ventas}
          encargos={encargos}
          esGestor={esGestor}
          rango={rango}
          hoy={hoy}
          truncado={(ventasRaw?.length ?? 0) >= LIMITE || (encargosRaw?.length ?? 0) >= LIMITE}
          limite={LIMITE}
        />
      </main>
    </div>
  )
}
