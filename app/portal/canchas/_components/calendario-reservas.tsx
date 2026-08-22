"use client"

// ─── Client Component ─────────────────────────────────────────────────────────
// Contiene toda la interactividad: selector de fecha + grid + panel lateral.
// El Server Component (page.tsx) le pasa los datos iniciales como props.

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Clock, DollarSign, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { crearReserva } from "../actions"
import type { Cancha, Reserva, EstadoPago } from "../types"

interface Props {
  canchas: Cancha[]
  reservasIniciales: Reserva[]
  fechaInicial: string   // YYYY-MM-DD
  ingresosDia: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const HORA_INICIO = 16   // 4 PM
const HORA_FIN    = 23   // 11 PM  (último slot = 22:00–23:00)
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i)

const ESTADO_CONFIG: Record<EstadoPago, { label: string; bg: string; border: string; dot: string }> = {
  pagado:     { label: "Pagado",     bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  debe_sena:  { label: "Debe seña",  bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400"  },
  pendiente:  { label: "Pendiente",  bg: "bg-blue-50",    border: "border-blue-200",     dot: "bg-blue-400"   },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatHora(h: number) {
  return `${h === 12 ? 12 : h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`
}

function formatFechaLabel(iso: string) {
  const d = new Date(iso + "T12:00:00")
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(d)
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00")
  d.setDate(d.getDate() + n)
  return d.toISOString().split("T")[0]
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}

function isHoy(iso: string) { return iso === new Date().toISOString().split("T")[0] }
function isTomorrow(iso: string) { return iso === addDays(new Date().toISOString().split("T")[0], 1) }

// ─── Componente ───────────────────────────────────────────────────────────────
export function CalendarioReservas({ canchas, reservasIniciales, fechaInicial, ingresosDia }: Props) {
  const router = useRouter()
  const [fecha, setFecha] = useState(fechaInicial)
  const [reservas] = useState<Reserva[]>(reservasIniciales)
  const [modalOpen, setModalOpen] = useState(false)
  const [slotSeleccionado, setSlotSeleccionado] = useState<{ canchaId: string; hora: number } | null>(null)

  // TODO: cuando cambies de fecha, hacer fetch de reservas_del_dia(fecha)
  // Por ahora muestra las iniciales (del día de hoy) en cualquier fecha
  const reservasDia = useMemo(() => reservas, [reservas, fecha])

  // Mapa rápido: "canchaId-hora" → reserva
  const reservaMap = useMemo(() => {
    const m = new Map<string, Reserva>()
    reservasDia.forEach(r => {
      for (let h = r.horaInicio; h < r.horaFin; h++) {
        m.set(`${r.canchaId}-${h}`, r)
      }
    })
    return m
  }, [reservasDia])

  // KPIs del panel lateral
  const totalSlots      = canchas.length * HORAS.length
  const slotsOcupados   = new Set(reservasDia.flatMap(r =>
    Array.from({ length: r.horaFin - r.horaInicio }, (_, i) => `${r.canchaId}-${r.horaInicio + i}`)
  )).size
  const ocupacionPct    = Math.round((slotsOcupados / totalSlots) * 100)

  const horaActual      = new Date().getHours()
  const proximaReserva  = reservasDia
    .filter(r => r.horaInicio > horaActual)
    .sort((a, b) => a.horaInicio - b.horaInicio)[0]

  const nombreFecha = isHoy(fecha) ? "Hoy" : isTomorrow(fecha) ? "Mañana" : formatFechaLabel(fecha)

  function abrirSlot(canchaId: string, hora: number) {
    setSlotSeleccionado({ canchaId, hora })
    setModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── SELECTOR DE FECHA ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* Navegación día anterior/siguiente */}
          <button
            onClick={() => setFecha(f => addDays(f, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Chips de acceso rápido */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
            {[
              { label: "Ayer",    offset: -1 },
              { label: "Hoy",     offset:  0 },
              { label: "Mañana",  offset:  1 },
            ].map(({ label, offset }) => {
              const target = addDays(new Date().toISOString().split("T")[0], offset)
              const active = fecha === target
              return (
                <button
                  key={label}
                  onClick={() => setFecha(target)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setFecha(f => addDays(f, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Selector de fecha nativo */}
          <div className="relative hidden sm:block">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>

        {/* Fecha actual label + botón nueva reserva */}
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-slate-600 capitalize">
            {nombreFecha}
            {isHoy(fecha) && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                En vivo
              </span>
            )}
          </p>

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 shadow-sm shadow-primary/20 hover:shadow-primary/30 hover:shadow-md transition-all"
                onClick={() => setSlotSeleccionado(null)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva reserva
              </Button>
            </DialogTrigger>
            <ModalNuevaReserva
              canchas={canchas}
              slotInicial={slotSeleccionado}
              fecha={fecha}
              onClose={() => setModalOpen(false)}
            />
          </Dialog>
        </div>
      </div>

      {/* ── GRID + PANEL ───────────────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* Grid de reservas — scroll horizontal en mobile */}
        <div className="flex-1 min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `80px repeat(${canchas.length}, minmax(160px, 1fr))`,
                minWidth: `${80 + canchas.length * 160}px`,
              }}
            >
              {/* ── Cabecera de canchas ─────────────────────────────────── */}
              {/* Celda esquina */}
              <div className="sticky left-0 z-20 border-b border-r border-slate-100 bg-slate-50 p-3">
                <Clock className="h-4 w-4 text-slate-400" />
              </div>

              {/* Headers de cada cancha */}
              {canchas.map(cancha => (
                <div
                  key={cancha.id}
                  className="border-b border-r border-slate-100 bg-slate-50 px-4 py-3 last:border-r-0"
                >
                  <p className="text-sm font-semibold text-slate-900 leading-none">{cancha.nombre}</p>
                  <p className="mt-1 text-xs text-slate-400">{cancha.tipo}</p>
                </div>
              ))}

              {/* ── Filas de horas ──────────────────────────────────────── */}
              {HORAS.map(hora => {
                const esHoraActual = isHoy(fecha) && hora === horaActual

                return (
                  <>
                    {/* Etiqueta de hora — sticky left */}
                    <div
                      key={`hora-${hora}`}
                      className={`sticky left-0 z-10 flex items-start border-b border-r border-slate-100 px-3 py-3 ${
                        esHoraActual ? "bg-primary/5" : "bg-white"
                      }`}
                    >
                      <span className={`text-xs font-medium tabular-nums ${
                        esHoraActual ? "text-primary font-semibold" : "text-slate-400"
                      }`}>
                        {formatHora(hora)}
                      </span>
                    </div>

                    {/* Celdas por cancha */}
                    {canchas.map(cancha => {
                      const key  = `${cancha.id}-${hora}`
                      const res  = reservaMap.get(key)
                      const esInicio = res?.horaInicio === hora

                      return (
                        <div
                          key={key}
                          onClick={() => !res && abrirSlot(cancha.id, hora)}
                          className={`relative border-b border-r border-slate-100 last:border-r-0 min-h-[64px] transition-colors ${
                            esHoraActual ? "bg-primary/5" : ""
                          } ${!res ? "cursor-pointer hover:bg-slate-50 group" : ""}`}
                        >
                          {/* Indicador de hora actual */}
                          {esHoraActual && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />
                          )}

                          {/* Slot vacío — hint al hover */}
                          {!res && (
                            <div className="absolute inset-2 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="h-4 w-4 text-slate-300" />
                            </div>
                          )}

                          {/* Bloque de reserva — solo se renderiza al inicio */}
                          {res && esInicio && (
                            <div
                              className={`absolute inset-1 rounded-xl border p-2.5 ${ESTADO_CONFIG[res.estadoPago].bg} ${ESTADO_CONFIG[res.estadoPago].border}`}
                              style={{
                                // Span multi-hora: alto proporcional a duración
                                height: `calc(${(res.horaFin - res.horaInicio) * 100}% + ${(res.horaFin - res.horaInicio - 1) * 1}px - 2px)`,
                                zIndex: 5,
                              }}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-900 truncate leading-tight">
                                    {res.clienteNombre}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-slate-500">
                                    {formatHora(res.horaInicio)} – {formatHora(res.horaFin)}
                                  </p>
                                </div>
                                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ESTADO_CONFIG[res.estadoPago].bg} ${ESTADO_CONFIG[res.estadoPago].border}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${ESTADO_CONFIG[res.estadoPago].dot}`} />
                                  {ESTADO_CONFIG[res.estadoPago].label}
                                </span>
                              </div>
                              <p className="mt-1.5 text-xs font-semibold text-slate-700">{fmt(res.monto)}</p>
                            </div>
                          )}

                          {/* Celdas de continuación de una reserva multi-hora → vacías visualmente */}
                          {res && !esInicio && (
                            <div className={`absolute inset-x-1 inset-y-0 ${ESTADO_CONFIG[res.estadoPago].bg} opacity-30`} />
                          )}
                        </div>
                      )
                    })}
                  </>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── PANEL LATERAL ──────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col gap-4 w-64 shrink-0">

          {/* Ingresos del día */}
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ingresos del día</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fmt(ingresosDia)}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span>{reservasDia.filter(r => r.estadoPago === "pagado").length} reservas cobradas</span>
            </div>
          </div>

          {/* Próxima reserva */}
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Próxima reserva</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
              </div>
            </div>
            {proximaReserva ? (
              <>
                <p className="text-sm font-semibold text-slate-900">{proximaReserva.clienteNombre}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {canchas.find(c => c.id === proximaReserva.canchaId)?.nombre}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                    <Clock className="h-3 w-3" />
                    {formatHora(proximaReserva.horaInicio)}
                  </span>
                  <span className="text-xs text-slate-400">
                    en {proximaReserva.horaInicio - horaActual}h
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Sin más reservas hoy</p>
            )}
          </div>

          {/* Ocupación */}
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ocupación</p>
              <Badge
                variant={ocupacionPct >= 75 ? "success" : ocupacionPct >= 40 ? "warning" : "secondary"}
                className="text-[11px]"
              >
                {ocupacionPct}%
              </Badge>
            </div>
            <div className="space-y-2">
              {canchas.map(cancha => {
                const slotsCancha = HORAS.filter(h => reservaMap.has(`${cancha.id}-${h}`)).length
                const pct = Math.round((slotsCancha / HORAS.length) * 100)
                return (
                  <div key={cancha.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-600 truncate max-w-[120px]">{cancha.nombre}</span>
                      <span className="text-[11px] font-medium text-slate-700">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Leyenda de estados */}
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Leyenda</p>
            <div className="space-y-2">
              {(Object.entries(ESTADO_CONFIG) as [EstadoPago, typeof ESTADO_CONFIG[EstadoPago]][]).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                  <span className="text-xs text-slate-600">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── Modal Nueva Reserva ──────────────────────────────────────────────────────
function ModalNuevaReserva({
  canchas,
  slotInicial,
  fecha,
  onClose,
}: {
  canchas: Cancha[]
  slotInicial: { canchaId: string; hora: number } | null
  fecha: string
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(e.currentTarget)

    try {
      await crearReserva({
        cancha_id:        form.get("cancha")      as string,
        cliente_nombre:   form.get("cliente")     as string,
        cliente_telefono: form.get("telefono")    as string || undefined,
        fecha,
        hora_inicio:      Number(form.get("hora_inicio")),
        hora_fin:         Number(form.get("hora_fin")),
        monto:            Number(form.get("monto")),
        estado_pago:      form.get("estado")      as EstadoPago,
        nota:             form.get("nota")        as string || undefined,
      })
      onClose()
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? "Error al crear la reserva")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-xl">Nueva Reserva</DialogTitle>
        <DialogDescription>Completa los datos para registrar la reserva.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="mt-2 space-y-4">
        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="r-cliente">Cliente</Label>
          <Input id="r-cliente" name="cliente" placeholder="Nombre completo" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r-telefono">Teléfono (opcional)</Label>
          <Input id="r-telefono" name="telefono" placeholder="809-000-0000" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-cancha">Cancha</Label>
            <Select name="cancha" defaultValue={slotInicial?.canchaId ?? canchas[0]?.id}>
              <SelectTrigger id="r-cancha"><SelectValue /></SelectTrigger>
              <SelectContent>
                {canchas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-estado">Estado pago</Label>
            <Select name="estado" defaultValue="pendiente">
              <SelectTrigger id="r-estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="debe_sena">Debe seña</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-inicio">Hora inicio</Label>
            <Select name="hora_inicio" defaultValue={String(slotInicial?.hora ?? 16)}>
              <SelectTrigger id="r-inicio"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HORAS.map(h => (
                  <SelectItem key={h} value={String(h)}>{formatHora(h)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-fin">Hora fin</Label>
            <Select name="hora_fin" defaultValue={String((slotInicial?.hora ?? 16) + 1)}>
              <SelectTrigger id="r-fin"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HORAS.filter(h => h > (slotInicial?.hora ?? 16)).map(h => (
                  <SelectItem key={h} value={String(h)}>{formatHora(h)}</SelectItem>
                ))}
                <SelectItem value={String(HORA_FIN)}>{formatHora(HORA_FIN)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r-monto">Monto (COP)</Label>
          <Input id="r-monto" name="monto" type="number" min="0" step="50" placeholder="1,500" required />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading
              ? <span className="flex items-center gap-2"><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Guardando…</span>
              : "Confirmar reserva"
            }
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
