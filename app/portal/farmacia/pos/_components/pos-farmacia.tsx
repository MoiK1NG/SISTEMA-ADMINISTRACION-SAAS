"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Search, ScanBarcode, Plus, Minus, Trash2, ShoppingCart, CheckCircle2,
  Loader2, UserRound, Repeat2, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { registrarVentaFarmacia, crearClienteFarmacia, type RecetaVenta } from "../../actions"
import { METODOS_PAGO_FARMACIA, METODO_PAGO_LABEL, type MetodoPagoFarmacia } from "@/lib/farmacia/pos-constants"

export interface ProductoPos {
  id:               string
  codigo_barras:    string | null
  nombre:           string
  principio_activo: string | null
  concentracion:    string | null
  presentacion:     string | null
  precio:           number
  requiere_receta:  boolean
  stock:            number
}

export interface ClientePos { id: string; nombre: string; cedula: string | null; telefono: string | null }

interface ItemCarrito { producto: ProductoPos; cantidad: number }

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)

interface Props {
  productos:   ProductoPos[]
  clientes:    ClientePos[]
  soloLectura: boolean
}

export function PosFarmacia({ productos, clientes, soloLectura }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busqueda, setBusqueda] = useState("")
  const [carrito, setCarrito]   = useState<ItemCarrito[]>([])
  const [cliente, setCliente]   = useState<ClientePos | null>(null)

  const [cobroAbierto, setCobroAbierto] = useState(false)
  const [exito, setExito] = useState<{ numero: number; total: number; vuelto: number } | null>(null)

  // ── Búsqueda: código de barras exacto o texto ─────────────────────────────
  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.principio_activo ?? "").toLowerCase().includes(q) ||
      (p.codigo_barras ?? "") === q
    ).slice(0, 12)
  }, [productos, busqueda])

  function agregar(p: ProductoPos) {
    if (p.stock <= 0) return
    setCarrito(prev => {
      const existe = prev.find(i => i.producto.id === p.id)
      if (existe) {
        if (existe.cantidad >= p.stock) return prev   // no vender más de lo que hay
        return prev.map(i => i.producto.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, { producto: p, cantidad: 1 }]
    })
    setBusqueda("")
    inputRef.current?.focus()
  }

  // Lector de barras: dispara Enter → si hay coincidencia exacta, agrega directo
  function onEnterBusqueda() {
    const q = busqueda.trim()
    if (!q) return
    const porCodigo = productos.find(p => p.codigo_barras === q)
    if (porCodigo) { agregar(porCodigo); return }
    if (resultados.length === 1) agregar(resultados[0])
  }

  function cambiarCantidad(id: string, delta: number) {
    setCarrito(prev => prev
      .map(i => {
        if (i.producto.id !== id) return i
        const nueva = Math.min(i.cantidad + delta, i.producto.stock)
        return { ...i, cantidad: nueva }
      })
      .filter(i => i.cantidad > 0))
  }

  const total = carrito.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)

  function ventaCompletada(r: { numero: number; total: number; vuelto: number }) {
    setExito(r)
    setCobroAbierto(false)
    setCarrito([])
    setCliente(null)
    router.refresh()
    setTimeout(() => setExito(null), 3500)
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-11rem)] lg:flex-row">

      {/* ══ Izquierda: búsqueda y resultados ══════════════════════════════════ */}
      <div className="flex min-w-0 flex-[7] flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            autoFocus
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onEnterBusqueda()}
            placeholder="Escanea el código o busca por nombre / principio activo…"
            className="h-13 w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-11 text-sm shadow-sm outline-none transition-all focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
          />
          <ScanBarcode className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
        </div>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          {busqueda.trim() === "" ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
              <ScanBarcode className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm font-medium text-slate-500">Escanea un producto o empieza a escribir</p>
              <p className="mt-1 text-xs text-slate-400">El lector de código de barras funciona directo sobre el buscador</p>
            </div>
          ) : resultados.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
              <p className="text-3xl">🔍</p>
              <p className="mt-2 text-sm font-medium text-slate-600">Sin resultados para “{busqueda}”</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {resultados.map(p => {
                const sinStock = p.stock <= 0
                const equivalentes = sinStock && p.principio_activo
                  ? productos.filter(e =>
                      e.id !== p.id && e.stock > 0 &&
                      e.principio_activo === p.principio_activo
                    ).slice(0, 3)
                  : []
                return (
                  <div key={p.id}>
                    <button
                      onClick={() => agregar(p)}
                      disabled={sinStock || soloLectura}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                        sinStock
                          ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-70"
                          : "border-slate-100 bg-white hover:border-teal-300 hover:bg-teal-50/50 active:scale-[0.99]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {p.nombre} {p.concentracion && <span className="font-normal text-slate-400">{p.concentracion}</span>}
                          {p.requiere_receta && (
                            <span className="ml-2 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">Rx</span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {p.principio_activo ?? "—"}{p.presentacion ? ` · ${p.presentacion}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-slate-900">{fmt(p.precio)}</p>
                        <p className={`text-[11px] font-semibold ${sinStock ? "text-rose-500" : "text-emerald-600"}`}>
                          {sinStock ? "Sin stock" : `${p.stock} disp.`}
                        </p>
                      </div>
                    </button>

                    {equivalentes.length > 0 && (
                      <div className="ml-4 mt-1 flex flex-wrap items-center gap-1.5 rounded-xl bg-teal-50/60 px-3 py-2">
                        <Repeat2 className="h-3 w-3 text-teal-600" />
                        <span className="text-[11px] font-semibold text-teal-800">Equivalentes con stock:</span>
                        {equivalentes.map(e => (
                          <button key={e.id} onClick={() => agregar(e)} disabled={soloLectura}
                                  className="rounded-full border border-teal-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-teal-800 hover:bg-teal-100">
                            {e.nombre} · {fmt(e.precio)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ Derecha: ticket ═══════════════════════════════════════════════════ */}
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:w-[360px] lg:shrink-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-900">Ticket</p>
          </div>
          {carrito.length > 0 && (
            <button onClick={() => setCarrito([])} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-500 hover:bg-rose-50">
              <Trash2 className="h-3 w-3" />Limpiar
            </button>
          )}
        </div>

        {/* Cliente */}
        <div className="border-b border-slate-50 px-4 py-2.5">
          <SelectorCliente clientes={clientes} value={cliente} onChange={setCliente} disabled={soloLectura} />
        </div>

        {/* Items */}
        <div className="min-h-[160px] flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
          {carrito.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-300">Toca un producto para agregarlo</p>
          ) : carrito.map(i => (
            <div key={i.producto.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800">
                  {i.producto.nombre} {i.producto.concentracion ?? ""}
                </p>
                <p className="text-[10px] text-slate-400">{fmt(i.producto.precio)} c/u</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => cambiarCantidad(i.producto.id, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-rose-500">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold tabular-nums">{i.cantidad}</span>
                <button onClick={() => cambiarCantidad(i.producto.id, 1)}
                        disabled={i.cantidad >= i.producto.stock}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-30">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <p className="w-16 shrink-0 text-right text-xs font-bold tabular-nums">{fmt(i.producto.precio * i.cantidad)}</p>
            </div>
          ))}
        </div>

        {/* Total + cobrar */}
        <div className="space-y-3 border-t border-slate-100 px-4 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-slate-900">Total</span>
            <span className="text-2xl font-black tabular-nums text-slate-900">{fmt(total)}</span>
          </div>
          <Button
            className="h-12 w-full rounded-xl bg-teal-600 text-base font-bold hover:bg-teal-700"
            disabled={carrito.length === 0 || soloLectura}
            onClick={() => setCobroAbierto(true)}
          >
            💳 Cobrar {total > 0 ? fmt(total) : ""}
          </Button>
          {soloLectura && (
            <p className="text-center text-[11px] text-amber-600">Modo lectura: no se puede vender</p>
          )}
        </div>
      </div>

      {/* Modal de cobro mixto */}
      <ModalCobroMixto
        open={cobroAbierto}
        total={total}
        items={carrito.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad }))}
        productosRx={carrito.filter(i => i.producto.requiere_receta).map(i => i.producto.nombre)}
        clienteId={cliente?.id ?? null}
        onClose={() => setCobroAbierto(false)}
        onCompletada={ventaCompletada}
      />

      {/* Toast de éxito */}
      {exito && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-3.5 shadow-xl">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="text-sm font-bold text-slate-900">Venta #{exito.numero} registrada · {fmt(exito.total)}</p>
            {exito.vuelto > 0 && <p className="text-xs font-semibold text-emerald-600">Vuelto: {fmt(exito.vuelto)}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Selector de cliente con alta rápida ─────────────────────────────────── */
function SelectorCliente({ clientes, value, onChange, disabled }: {
  clientes: ClientePos[]
  value:    ClientePos | null
  onChange: (c: ClientePos | null) => void
  disabled: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState("")
  const [nuevo, setNuevo] = useState<{ nombre: string; cedula: string; telefono: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const filtrados = q.trim()
    ? clientes.filter(c =>
        c.nombre.toLowerCase().includes(q.toLowerCase()) || (c.cedula ?? "").includes(q.trim())
      ).slice(0, 6)
    : clientes.slice(0, 6)

  function crear() {
    if (!nuevo) return
    start(async () => {
      try {
        const c = await crearClienteFarmacia(nuevo)
        onChange(c as ClientePos)
        setAbierto(false); setNuevo(null); setQ("")
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo crear") }
    })
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-teal-600" />
          <p className="truncate text-xs font-semibold text-slate-800">{value.nombre}</p>
          {value.cedula && <span className="shrink-0 text-[10px] text-slate-400">CC {value.cedula}</span>}
        </div>
        <button onClick={() => onChange(null)} className="shrink-0 text-slate-300 hover:text-slate-500">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        disabled={disabled}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-xs text-slate-400 hover:text-slate-600"
      >
        <UserRound className="h-3.5 w-3.5" />
        Cliente (opcional) — toca para buscar o crear
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{nuevo ? "Nuevo cliente" : "Cliente"}</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-3">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

            {nuevo === null ? (
              <>
                <Input autoFocus placeholder="Buscar por nombre o cédula…" value={q} onChange={e => setQ(e.target.value)} />
                <div className="max-h-52 space-y-1 overflow-y-auto">
                  {filtrados.map(c => (
                    <button key={c.id}
                            onClick={() => { onChange(c); setAbierto(false); setQ("") }}
                            className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-left text-sm hover:bg-teal-50">
                      <span className="font-medium text-slate-800">{c.nombre}</span>
                      <span className="text-xs text-slate-400">{c.cedula ? `CC ${c.cedula}` : ""}</span>
                    </button>
                  ))}
                  {filtrados.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-400">Sin resultados</p>
                  )}
                </div>
                <Button variant="outline" className="w-full gap-1.5"
                        onClick={() => setNuevo({ nombre: q.trim(), cedula: "", telefono: "" })}>
                  <Plus className="h-3.5 w-3.5" />Crear cliente nuevo
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input autoFocus value={nuevo.nombre} onChange={e => setNuevo(n => n && ({ ...n, nombre: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cédula</Label>
                    <Input value={nuevo.cedula} onChange={e => setNuevo(n => n && ({ ...n, cedula: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Teléfono</Label>
                    <Input value={nuevo.telefono} onChange={e => setNuevo(n => n && ({ ...n, telefono: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setNuevo(null)}>Volver</Button>
                  <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={crear}
                          disabled={isPending || !nuevo.nombre.trim()}>
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Crear y usar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── Cobro con pago mixto ─────────────────────────────────────────────────── */
const RECETA_VACIA = {
  paciente_nombre: "", paciente_documento: "", medico_nombre: "", medico_registro: "", numero_receta: "",
}

function ModalCobroMixto({ open, total, items, productosRx, clienteId, onClose, onCompletada }: {
  open:      boolean
  total:     number
  items:     { producto_id: string; cantidad: number }[]
  productosRx: string[]
  clienteId: string | null
  onClose:   () => void
  onCompletada: (r: { numero: number; total: number; vuelto: number }) => void
}) {
  const [montos, setMontos] = useState<Record<MetodoPagoFarmacia, string>>({
    efectivo: "", tarjeta_debito: "", tarjeta_credito: "", transferencia: "",
  })
  const [receta, setReceta] = useState(RECETA_VACIA)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const hayRx = productosRx.length > 0
  const recetaCompleta = !hayRx || (
    receta.paciente_nombre.trim() !== "" &&
    receta.paciente_documento.trim() !== "" &&
    receta.medico_nombre.trim() !== "" &&
    receta.numero_receta.trim() !== ""
  )

  const pagado     = METODOS_PAGO_FARMACIA.reduce((s, m) => s + (Number(montos[m]) || 0), 0)
  const noEfectivo = pagado - (Number(montos.efectivo) || 0)
  const falta      = Math.max(0, total - pagado)
  const vuelto     = Math.max(0, pagado - total)
  const valido     = pagado >= total && noEfectivo <= total && recetaCompleta

  function setMonto(m: MetodoPagoFarmacia, v: string) {
    setMontos(prev => ({ ...prev, [m]: v }))
  }

  function pagoExacto(m: MetodoPagoFarmacia) {
    const otros = METODOS_PAGO_FARMACIA.filter(x => x !== m).reduce((s, x) => s + (Number(montos[x]) || 0), 0)
    setMonto(m, String(Math.max(0, total - otros)))
  }

  function confirmar() {
    setError(null)
    const pagos = METODOS_PAGO_FARMACIA
      .filter(m => Number(montos[m]) > 0)
      .map(m => ({ metodo: m, monto: Number(montos[m]) }))
    start(async () => {
      try {
        const datosReceta: RecetaVenta | null = hayRx ? {
          paciente_nombre:    receta.paciente_nombre,
          paciente_documento: receta.paciente_documento,
          medico_nombre:      receta.medico_nombre,
          medico_registro:    receta.medico_registro || undefined,
          numero_receta:      receta.numero_receta,
        } : null
        const r = await registrarVentaFarmacia({ items, pagos, cliente_id: clienteId, receta: datosReceta })
        setMontos({ efectivo: "", tarjeta_debito: "", tarjeta_credito: "", transferencia: "" })
        setReceta(RECETA_VACIA)
        onCompletada(r)
      } catch (e: any) { setError(e?.message ?? "No se pudo registrar la venta") }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isPending) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Cobrar</DialogTitle></DialogHeader>
        <div className="mt-2 space-y-4">
          {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-500">Total a cobrar</p>
            <p className="text-3xl font-black text-slate-900">{fmt(total)}</p>
          </div>

          {hayRx && (
            <div className="space-y-2.5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-800">
                💊 Control especial — receta obligatoria
              </p>
              <p className="text-[11px] leading-relaxed text-violet-700">
                {productosRx.join(", ")} {productosRx.length === 1 ? "requiere" : "requieren"} receta.
                Estos datos van al libro de control.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Paciente *" value={receta.paciente_nombre}
                       onChange={e => setReceta(r => ({ ...r, paciente_nombre: e.target.value }))} className="h-9 bg-white" />
                <Input placeholder="Documento *" value={receta.paciente_documento}
                       onChange={e => setReceta(r => ({ ...r, paciente_documento: e.target.value }))} className="h-9 bg-white" />
                <Input placeholder="Médico *" value={receta.medico_nombre}
                       onChange={e => setReceta(r => ({ ...r, medico_nombre: e.target.value }))} className="h-9 bg-white" />
                <Input placeholder="Registro médico" value={receta.medico_registro}
                       onChange={e => setReceta(r => ({ ...r, medico_registro: e.target.value }))} className="h-9 bg-white" />
              </div>
              <Input placeholder="Número de receta *" value={receta.numero_receta}
                     onChange={e => setReceta(r => ({ ...r, numero_receta: e.target.value }))} className="h-9 bg-white" />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Pago (combina los métodos que necesites)
            </p>
            {METODOS_PAGO_FARMACIA.map(m => (
              <div key={m} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-medium text-slate-600">{METODO_PAGO_LABEL[m]}</span>
                <Input
                  type="number" min="0" placeholder="0"
                  value={montos[m]}
                  onChange={e => setMonto(m, e.target.value)}
                  className="h-9 text-right tabular-nums"
                />
                <button onClick={() => pagoExacto(m)}
                        className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-50">
                  resto
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-1 rounded-xl border border-slate-100 px-4 py-2.5 text-sm">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Pagado</span><span className="tabular-nums">{fmt(pagado)}</span>
            </div>
            {falta > 0 && (
              <div className="flex justify-between font-semibold text-rose-600">
                <span>Falta</span><span className="tabular-nums">{fmt(falta)}</span>
              </div>
            )}
            {vuelto > 0 && (
              <div className="flex justify-between font-semibold text-emerald-600">
                <span>Vuelto (del efectivo)</span><span className="tabular-nums">{fmt(vuelto)}</span>
              </div>
            )}
            {noEfectivo > total && (
              <p className="text-xs font-medium text-rose-600">Los pagos electrónicos no pueden superar el total</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={confirmar} disabled={!valido || isPending}>
              {isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Registrando…</> : "Confirmar venta"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
