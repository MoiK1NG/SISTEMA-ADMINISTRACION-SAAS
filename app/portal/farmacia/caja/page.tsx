import { Calculator } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { CierreCaja, type FilaCierre } from "./_components/cierre-caja"

export default async function CajaFarmaciaPage() {
  const { supabase, agenteId, viendoA, negocio, rol } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  const esGestor = rol === "dueno" || rol === "regente"

  // El cajero solo ve sus cierres (la RLS lo garantiza; acá igual filtramos)
  let query = supabase
    .from("cierres_caja_farmacia")
    .select("id, user_id, periodo_desde, periodo_hasta, declarado, esperado, diferencia, num_ventas, notas, created_at")
    .eq("negocio_id", negocio.id)
    .order("created_at", { ascending: false })
    .limit(30)
  if (!esGestor) query = query.eq("user_id", agenteId)

  const [{ data: cierresRaw }, { data: equipo }] = await Promise.all([
    query,
    supabase.rpc("equipo_negocio", { p_negocio: negocio.id }),
  ])

  const nombrePorUsuario = new Map<string, string>((equipo ?? []).map((m: any) => [m.user_id, m.nombre]))

  const cierres: FilaCierre[] = (cierresRaw ?? []).map((c: any) => ({
    id:         c.id,
    cajero:     nombrePorUsuario.get(c.user_id) ?? "—",
    desde:      c.periodo_desde,
    hasta:      c.periodo_hasta,
    declarado:  c.declarado,
    esperado:   c.esperado,
    diferencia: c.diferencia,
    ventas:     c.num_ventas,
    notas:      c.notas,
  }))

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <Calculator className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Cierre de caja</p>
            <p className="mt-0.5 text-xs text-slate-500">{negocio.nombre}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <CierreCaja
          cierres={cierres}
          esGestor={esGestor}
          soloLectura={Boolean(viendoA)}
        />
      </main>
    </div>
  )
}
