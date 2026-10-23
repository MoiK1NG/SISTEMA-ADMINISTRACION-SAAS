import Link from "next/link"
import { CheckCircle2, Circle, Rocket } from "lucide-react"

export interface PasoInicial {
  label: string
  hecho: boolean
  /** Dónde se resuelve; sin href, se resuelve en esta misma pantalla. */
  href?: string
  ayuda: string
}

/**
 * Lista de "Primeros pasos" del dueño, calculada en vivo en cada carga del
 * inicio. Desaparece sola cuando todo está hecho.
 */
export function PrimerosPasos({ pasos }: { pasos: PasoInicial[] }) {
  const hechos = pasos.filter(p => p.hecho).length
  if (hechos === pasos.length) return null

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-bold text-slate-900">Primeros pasos</h2>
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-500">{hechos} de {pasos.length}</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((hechos / pasos.length) * 100)}%` }} />
      </div>
      <ul className="space-y-2">
        {pasos.map(p => {
          const contenido = (
            <>
              {p.hecho
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
              <span>
                <span className={`block text-sm font-medium ${p.hecho ? "text-slate-400 line-through" : "text-slate-800"}`}>{p.label}</span>
                {!p.hecho && <span className="block text-xs text-slate-500">{p.ayuda}</span>}
              </span>
            </>
          )
          return (
            <li key={p.label}>
              {p.href && !p.hecho ? (
                <Link href={p.href} className="flex items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">{contenido}</Link>
              ) : (
                <div className="flex items-start gap-3 px-2 py-1.5">{contenido}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
