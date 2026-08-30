import { FileText, ShieldCheck } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { ExportarCsv } from "@/components/farmacia/exportar-csv"

const fmtFechaHora = (ts: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ts))

export default async function RecetasFarmaciaPage() {
  const { supabase, viendoA, negocio } = await contextoFarmacia()

  if (!negocio) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <PortalNav portal="farmacia" />
        <p className="py-24 text-center text-sm text-slate-500">No perteneces a ninguna farmacia.</p>
      </div>
    )
  }

  // Últimos 90 días — el CSV exporta lo visible
  const hace90 = new Date(); hace90.setDate(hace90.getDate() - 90)

  const { data: recetas } = await supabase
    .from("recetas_farmacia")
    .select("id, venta_numero, producto_nombre, cantidad, paciente_nombre, paciente_documento, medico_nombre, medico_registro, numero_receta, created_at")
    .eq("negocio_id", negocio.id)
    .gte("created_at", hace90.toISOString())
    .order("created_at", { ascending: false })

  const filas = recetas ?? []
  const hoyStr = new Date().toISOString().split("T")[0]

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900">Libro de control</p>
            <p className="mt-0.5 text-xs text-slate-500">Medicamentos de control especial · {negocio.nombre}</p>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-600" />
            <p className="text-xs leading-relaxed text-teal-800">
              Cada venta de un producto marcado &quot;requiere receta&quot; queda registrada acá
              automáticamente. El libro es <strong>inmutable</strong>: no se edita ni se borra.
            </p>
          </div>
          <ExportarCsv
            nombreArchivo={`libro-control-${negocio.nombre.toLowerCase().replace(/\s+/g, "-")}-${hoyStr}.csv`}
            encabezados={["Fecha", "Venta", "Medicamento", "Cantidad", "Paciente", "Documento", "Médico", "Registro médico", "Nº Receta"]}
            filas={filas.map((r: any) => [
              fmtFechaHora(r.created_at), r.venta_numero ? `#${r.venta_numero}` : "",
              r.producto_nombre, Number(r.cantidad), r.paciente_nombre, r.paciente_documento,
              r.medico_nombre, r.medico_registro ?? "", r.numero_receta,
            ])}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {filas.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-3xl">📋</p>
              <p className="mt-2 text-sm font-medium text-slate-700">El libro está vacío</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                Marca los medicamentos controlados con &quot;Requiere receta médica&quot; en el
                inventario: al venderlos, la caja pedirá los datos y el asiento aparecerá acá.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Medicamento</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Cant.</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Paciente</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Médico</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Nº Receta</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filas.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtFechaHora(r.created_at)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{r.producto_nombre}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{Number(r.cantidad)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-800">{r.paciente_nombre}</p>
                        <p className="text-[11px] text-slate-400">CC {r.paciente_documento}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-800">{r.medico_nombre}</p>
                        {r.medico_registro && <p className="text-[11px] text-slate-400">Reg. {r.medico_registro}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.numero_receta}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.venta_numero ? `#${r.venta_numero}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Se muestran los últimos 90 días. El botón exporta lo visible en CSV para presentar
          ante la autoridad sanitaria.
        </p>
      </main>
    </div>
  )
}
