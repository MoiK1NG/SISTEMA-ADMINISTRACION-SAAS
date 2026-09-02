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
  const esGestor = rol === "dueno" || rol === "regente"

  // Auditoría de accesos: cuándo inició y cerró sesión cada miembro
  const { data: accesos } = esGestor && negocio
    ? await supabase.rpc("accesos_equipo", { p_negocio: negocio.id })
    : { data: [] }

  const fmtAcceso = (ts: string) =>
    new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts))

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
          <>
            <EquipoManager
              miembros={miembros}
              puedeGestionar={puedeGestionar}
              miUserId={agenteId}
            />

            {esGestor && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-50 px-5 py-4">
                  <p className="text-sm font-bold text-slate-900">Auditoría de accesos</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Inicios y cierres de sesión del equipo (últimos 100 eventos) — junto con el
                    historial de cierres de caja, permite saber cuándo entró y salió cada quien
                  </p>
                </div>
                {(accesos ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">Sin eventos registrados todavía</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {(accesos ?? []).map((a: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-400">{fmtAcceso(a.fecha)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                a.accion === "login"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {a.accion === "login" ? "Inició sesión" : "Cerró sesión"}
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-xs font-medium text-slate-700">{a.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
