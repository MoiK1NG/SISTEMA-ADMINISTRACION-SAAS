import { HeartPulse } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { diasParaVencer } from "@/lib/farmacia/caducidad"
import { PacientesFarmacia, type FilaTratamiento, type ClienteCrm, type ProductoCrm } from "./_components/pacientes-farmacia"

export default async function PacientesFarmaciaPage() {
  const { supabase, viendoA, negocio } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  const [{ data: tratamientosRaw }, { data: clientes }, { data: productos }] = await Promise.all([
    supabase.from("tratamientos_farmacia")
      .select("id, producto_nombre, dias_duracion, ultima_compra, notas, activo, clientes_farmacia(nombre, telefono)")
      .eq("negocio_id", negocio.id)
      .order("ultima_compra"),
    supabase.from("clientes_farmacia")
      .select("id, nombre, cedula, telefono")
      .eq("negocio_id", negocio.id).order("nombre"),
    supabase.from("productos_farmacia")
      .select("id, nombre, concentracion")
      .eq("negocio_id", negocio.id).eq("activo", true).order("nombre"),
  ])

  const tratamientos: FilaTratamiento[] = (tratamientosRaw ?? []).map((t: any) => {
    const cli = Array.isArray(t.clientes_farmacia) ? t.clientes_farmacia[0] : t.clientes_farmacia
    // Fecha en que se le acaba: última compra + duración del tratamiento
    const seAcaba = new Date(t.ultima_compra + "T00:00:00")
    seAcaba.setDate(seAcaba.getDate() + t.dias_duracion)
    const fechaFin = seAcaba.toISOString().split("T")[0]
    return {
      id:              t.id,
      medicamento:     t.producto_nombre,
      dias_duracion:   t.dias_duracion,
      ultima_compra:   t.ultima_compra,
      se_acaba:        fechaFin,
      dias_restantes:  diasParaVencer(fechaFin),
      notas:           t.notas,
      activo:          t.activo,
      cliente:         cli?.nombre ?? "—",
      telefono:        cli?.telefono ?? null,
    }
  })

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <HeartPulse className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Pacientes crónicos</p>
            <p className="mt-0.5 text-xs text-slate-500">Recordatorios de tratamientos · {negocio.nombre}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PacientesFarmacia
          tratamientos={tratamientos}
          clientes={(clientes ?? []) as ClienteCrm[]}
          productos={(productos ?? []) as ProductoCrm[]}
          soloLectura={Boolean(viendoA)}
          nombreNegocio={negocio.nombre}
        />
      </main>
    </div>
  )
}
