"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, MessageCircle, RotateCcw, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { crearTratamiento, renovarTratamiento, alternarTratamiento } from "../../actions"

export interface ClienteCrm  { id: string; nombre: string; cedula: string | null; telefono: string | null }
export interface ProductoCrm { id: string; nombre: string; concentracion: string | null }

export interface FilaTratamiento {
  id:             string
  medicamento:    string
  dias_duracion:  number
  ultima_compra:  string
  se_acaba:       string
  dias_restantes: number
  notas:          string | null
  activo:         boolean
  cliente:        string
  telefono:       string | null
}

const fmtFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(new Date(iso + "T00:00:00"))

function estadoTratamiento(t: FilaTratamiento) {
  if (!t.activo) return { label: "Pausado", clases: "bg-slate-100 text-slate-500 border-slate-200", urgente: false }
  if (t.dias_restantes < 0)  return { label: `Se acabó hace ${-t.dias_restantes} días`, clases: "bg-rose-50 text-rose-700 border-rose-200", urgente: true }
  if (t.dias_restantes <= 3) return { label: `Quedan ${t.dias_restantes} días — avisar`, clases: "bg-amber-50 text-amber-700 border-amber-200", urgente: true }
  return { label: `Al día · quedan ${t.dias_restantes} días`, clases: "bg-emerald-50 text-emerald-700 border-emerald-200", urgente: false }
}

const FORM_VACIO = { cliente_id: "", producto_id: "", producto_nombre: "", dias_duracion: 30, notas: "" }

interface Props {
  tratamientos:  FilaTratamiento[]
  clientes:      ClienteCrm[]
  productos:     ProductoCrm[]
  soloLectura:   boolean
  nombreNegocio: string
}

export function PacientesFarmacia({ tratamientos, clientes, productos, soloLectura, nombreNegocio }: Props) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<"avisar" | "todos">("avisar")
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const urgentes = tratamientos.filter(t => estadoTratamiento(t).urgente)

  const visibles = useMemo(() =>
    filtro === "avisar" ? urgentes : tratamientos,
    [filtro, tratamientos, urgentes])

  function correr(fn: () => Promise<unknown>, despues?: () => void) {
    setError(null)
    start(async () => {
      try { await fn(); despues?.(); router.refresh() }
      catch (e: any) { setError(e?.message ?? "No se pudo completar") }
    })
  }

  function linkWhatsApp(t: FilaTratamiento) {
    const tel = (t.telefono ?? "").replace(/\D/g, "")
    const numero = tel.startsWith("57") ? tel : `57${tel}`
    const dias = t.dias_restantes
    const cuando = dias < 0 ? "ya se te terminó" : dias === 0 ? "se te termina hoy" : `se te termina en ${dias} ${dias === 1 ? "día" : "días"}`
    const texto = encodeURIComponent(
      `Hola ${t.cliente}! Te escribimos de ${nombreNegocio}: tu medicamento ${t.medicamento} ${cuando}. ¿Quieres que te lo dejemos listo o te lo encarguemos? 💊`
    )
    return `https://wa.me/${numero}?text=${texto}`
  }

  return (
    <div className="space-y-4">
      {error && !nuevoAbierto && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button onClick={() => setFiltro("avisar")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    filtro === "avisar" ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
            🔔 Para avisar ({urgentes.length})
          </button>
          <button onClick={() => setFiltro("todos")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    filtro === "todos" ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
            Todos ({tratamientos.length})
          </button>
        </div>
        {!soloLectura && (
          <Button size="sm" onClick={() => { setError(null); setNuevoAbierto(true) }}
                  className="gap-1.5 bg-teal-600 hover:bg-teal-700">
            <Plus className="h-3.5 w-3.5" />Nuevo tratamiento
          </Button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-3xl">💚</p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {filtro === "avisar" ? "Nadie necesita aviso por ahora" : "Sin tratamientos registrados"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
            Registra el tratamiento crónico de un paciente (medicamento y cada cuántos días
            se le acaba) y el sistema te dirá cuándo avisarle para que no se quede sin él.
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isPending ? "opacity-60" : ""}`}>
          {visibles.map(t => {
            const est = estadoTratamiento(t)
            return (
              <div key={t.id} className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm ${
                est.urgente ? "border-amber-200" : "border-slate-100"
              } ${!t.activo ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{t.cliente}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{t.medicamento}</p>
                  </div>
                </div>

                <span className={`mt-2 inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${est.clases}`}>
                  {est.label}
                </span>

                <div className="mt-3 space-y-0.5 text-[11px] text-slate-400">
                  <p>Última compra: {fmtFecha(t.ultima_compra)} · dura {t.dias_duracion} días</p>
                  <p>Se le acaba: <strong className="text-slate-600">{fmtFecha(t.se_acaba)}</strong></p>
                  {t.notas && <p className="italic">{t.notas}</p>}
                </div>

                {!soloLectura && (
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-50 pt-3">
                    {est.urgente && t.telefono && (
                      <a href={linkWhatsApp(t)} target="_blank" rel="noopener noreferrer"
                         className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 text-xs font-bold text-white hover:bg-emerald-600">
                        <MessageCircle className="h-3.5 w-3.5" />Avisar por WhatsApp
                      </a>
                    )}
                    <button onClick={() => correr(() => renovarTratamiento(t.id))}
                            className="flex h-8 items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-xs font-bold text-teal-700 hover:bg-teal-100"
                            title="Volvió a comprar: reiniciar el ciclo desde hoy">
                      <RotateCcw className="h-3 w-3" />Compró
                    </button>
                    <button onClick={() => correr(() => alternarTratamiento(t.id, !t.activo))}
                            className="ml-auto rounded-lg p-1.5 text-slate-300 hover:bg-slate-50 hover:text-slate-600"
                            title={t.activo ? "Pausar recordatorios" : "Reactivar"}>
                      <Power className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        &quot;Compró&quot; reinicia el ciclo desde hoy. El aviso de WhatsApp se sugiere cuando
        quedan 3 días o menos.
      </p>

      {/* ── Dialog nuevo tratamiento ─────────────────────────────────────────── */}
      <Dialog open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nuevo tratamiento crónico</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

            <div className="space-y-1.5">
              <Label>Paciente * (necesita teléfono para el aviso)</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.cliente_id}
                      onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.telefono ? ` · ${c.telefono}` : " · SIN TELÉFONO"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Medicamento *</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.producto_id}
                      onChange={e => {
                        const p = productos.find(x => x.id === e.target.value)
                        setForm(f => ({
                          ...f,
                          producto_id: e.target.value,
                          producto_nombre: p ? `${p.nombre}${p.concentracion ? " " + p.concentracion : ""}` : f.producto_nombre,
                        }))
                      }}>
                <option value="">— Del catálogo, o escríbelo abajo —</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.concentracion ?? ""}</option>
                ))}
              </select>
              <Input placeholder="O escribe el medicamento…" value={form.producto_nombre}
                     onChange={e => setForm(f => ({ ...f, producto_nombre: e.target.value, producto_id: "" }))} />
            </div>

            <div className="space-y-1.5">
              <Label>¿Cada cuántos días se le acaba? *</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min="1" max="365" className="w-24" value={form.dias_duracion || ""}
                       onChange={e => setForm(f => ({ ...f, dias_duracion: Number(e.target.value) }))} />
                <div className="flex gap-1.5">
                  {[15, 30, 60, 90].map(d => (
                    <button key={d} type="button" onClick={() => setForm(f => ({ ...f, dias_duracion: d }))}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                              form.dias_duracion === d ? "border-teal-600 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input placeholder="Ej: toma 2 al día, hipertensión…" value={form.notas}
                     onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setNuevoAbierto(false)}>Cancelar</Button>
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700"
                      disabled={isPending || !form.cliente_id || !form.producto_nombre.trim() || !(form.dias_duracion >= 1)}
                      onClick={() => correr(
                        () => crearTratamiento({ ...form, producto_id: form.producto_id || null }),
                        () => { setNuevoAbierto(false); setForm(FORM_VACIO) },
                      )}>
                {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando…</> : "Registrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
