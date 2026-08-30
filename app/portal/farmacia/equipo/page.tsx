import { Users } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { EquipoManager, type FilaMiembro } from "./_components/equipo-manager"

export default async function EquipoPage() {
  const { supabase, agenteId, viendoA, negocio, rol } = await contextoFarmacia()

  const { data: equipoRaw } = negocio
    ? await supabase.rpc("equipo_negocio", { p_negocio: negocio.id })
    : { data: [] }

  const miembros: FilaMiembro[] = (equipoRaw ?? []).map((m: any) => ({
    id:       m.miembro_id,
    user_id:  m.user_id,
    rol:      m.rol,
    nombre:   m.nombre ?? m.email,
    email:    m.email,
    aprobado: m.aprobado,
    desde:    m.desde,
  }))

  // En modo "ver como" se muestra pero no se gestiona (las actions ya lo bloquean)
  const puedeGestionar = rol === "dueno" && !viendoA

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Equipo</p>
            <p className="mt-0.5 text-xs text-slate-500">{negocio?.nombre ?? "Farmacia"}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {!negocio ? (
          <p className="py-20 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
        ) : (
          <EquipoManager
            miembros={miembros}
            puedeGestionar={puedeGestionar}
            miUserId={agenteId}
          />
        )}
      </main>
    </div>
  )
}
