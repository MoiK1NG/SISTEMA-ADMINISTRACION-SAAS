"use client"

import { useState, useTransition } from "react"
import { Loader2, ArrowUpFromLine, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useFormato } from "@/components/farmacia/negocio-provider"
import { anularMovimientoCaja, registrarMovimientoCaja } from "../../actions"
import {
  CATEGORIAS_GASTO, CATEGORIA_GASTO_LABEL, type CategoriaGasto, type TipoMovimientoCaja,
} from "@/lib/farmacia/pos-constants"

export interface MovimientoCaja {
  id:        string
  tipo:      TipoMovimientoCaja
  monto:     number
  concepto:  string
  categoria: CategoriaGasto | null
  hora:      string
  autor:     string
  propio:    boolean
  anulado:   boolean
  motivo:    string | null
}

/**
 * Botones "Retiro de caja" y "Gasto" con su diálogo. Solo efectivo: es plata
 * que sale del cajón durante el turno y que el cierre descuenta.
 */
export function BotonesSalidaCaja({ onRegistrado }: { onRegistrado: (m: MovimientoCaja) => void }) {
  const f = useFormato()
  const [tipo, setTipo] = useState<TipoMovimientoCaja | null>(null)
  const [monto, setMonto] = useState("")
  const [concepto, setConcepto] = useState("")
  const [categoria, setCategoria] = useState<CategoriaGasto | "">("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function abrir(t: TipoMovimientoCaja) {
    setTipo(t); setMonto(""); setConcepto(""); setCategoria(""); setError(null)
  }

  function guardar() {
    if (!tipo) return
    setError(null)
    start(async () => {
      try {
        const m = await registrarMovimientoCaja({ tipo, monto: Number(monto), concepto, categoria: categoria || null })
        onRegistrado({
          id: m.id, tipo: m.tipo, monto: m.monto, concepto: m.concepto, categoria: m.categoria,
          hora: m.created_at, autor: "Tú", propio: true, anulado: false, motivo: null,
        })
        setTipo(null)
      } catch (e: any) { setError(e?.message ?? "No se pudo registrar") }
    })
  }

  const listo = Number(monto) > 0 && concepto.trim().length > 0 && (tipo === "retiro" || categoria !== "")

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-11 gap-2 rounded-xl" onClick={() => abrir("retiro")}>
          <ArrowUpFromLine className="h-4 w-4 text-brand-600" />Retiro de caja
        </Button>
        <Button variant="outline" className="h-11 gap-2 rounded-xl" onClick={() => abrir("gasto")}>
          <Receipt className="h-4 w-4 text-brand-600" />Gasto
        </Button>
      </div>

      <Dialog open={tipo !== null} onOpenChange={v => { if (!v) setTipo(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tipo === "retiro" ? "Retiro de caja" : "Gasto pagado con la caja"}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs leading-relaxed text-slate-600">
              {tipo === "retiro"
                ? "Efectivo que sale del cajón para el dueño o para depositar. No es un gasto del negocio."
                : "Un gasto menor pagado con efectivo de la caja. Guarda la boleta o el comprobante."}
              {" "}El cierre lo descuenta del efectivo esperado.
            </p>
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <div className="space-y-1.5">
              <Label>Monto en efectivo *</Label>
              <Input autoFocus type="number" min="0" placeholder="0" value={monto}
                     onChange={e => setMonto(e.target.value)} className="text-right tabular-nums" />
              {Number(monto) > 0 && <p className="text-right text-[11px] text-slate-400">{f.dinero(Number(monto))}</p>}
            </div>
            {tipo === "gasto" && (
              <div className="space-y-1.5">
                <Label>Categoría *</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={categoria} onChange={e => setCategoria(e.target.value as CategoriaGasto | "")}>
                  <option value="">Elige una…</option>
                  {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{CATEGORIA_GASTO_LABEL[c]}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{tipo === "retiro" ? "Para qué o para quién *" : "En qué se gastó *"}</Label>
              <Input placeholder={tipo === "retiro" ? "Ej.: remesa para el dueño" : "Ej.: bidón de agua"}
                     value={concepto} onChange={e => setConcepto(e.target.value)} maxLength={120} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setTipo(null)}>Cancelar</Button>
              <Button className="flex-1 bg-brand-600 hover:bg-brand-700" disabled={isPending || !listo} onClick={guardar}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Registrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Diálogo para anular un retiro o gasto del turno abierto. */
export function AnularMovimientoDialog({ movimiento, onCerrar, onAnulado }: {
  movimiento: MovimientoCaja | null
  onCerrar:   () => void
  onAnulado:  (id: string, motivo: string) => void
}) {
  const f = useFormato()
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function anular() {
    if (!movimiento) return
    setError(null)
    start(async () => {
      try {
        await anularMovimientoCaja(movimiento.id, motivo)
        onAnulado(movimiento.id, motivo.trim())
        setMotivo("")
      } catch (e: any) { setError(e?.message ?? "No se pudo anular") }
    })
  }

  return (
    <Dialog open={movimiento !== null} onOpenChange={v => { if (!v) { setMotivo(""); setError(null); onCerrar() } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Anular {movimiento?.tipo === "retiro" ? "retiro" : "gasto"}</DialogTitle></DialogHeader>
        {movimiento && (
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              {movimiento.concepto} · <strong>{f.dinero(movimiento.monto)}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Input autoFocus placeholder="Ej.: monto mal digitado" value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onCerrar}>Volver</Button>
              <Button variant="destructive" className="flex-1" disabled={isPending || motivo.trim().length < 3} onClick={anular}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Anular"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
