"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useFormato, useNegocioUI } from "@/components/farmacia/negocio-provider"
import { ID_FISCAL } from "@/lib/farmacia/formato"
import { METODO_PAGO_LABEL, type MetodoPagoFarmacia } from "@/lib/farmacia/pos-constants"

export interface TicketData {
  numero:  number
  /** ISO con hora */
  fecha:   string
  total:   number
  vuelto:  number
  cliente: string | null
  anulada?: boolean
  lineas:  { nombre: string; cantidad: number; precio: number }[]
  pagos:   { metodo: string; monto: number }[]
}

/**
 * Comprobante interno de una venta, para imprimir en impresora térmica de
 * 80 mm o en hoja común. No es boleta ni factura: el documento tributario
 * sigue saliendo por el canal que use la farmacia.
 *
 * Al imprimir, globals.css oculta todo menos el bloque #ticket-impresion, que
 * vive fuera del diálogo (el diálogo está transformado y recortaría la hoja).
 */
export function TicketVenta({ venta, open, onOpenChange }: {
  venta: TicketData | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const f = useFormato()
  const { negocio, moneda } = useNegocioUI()
  if (!venta) return null

  const cuerpo = (
    <div className="font-mono text-[12px] leading-snug text-slate-900">
      <div className="text-center">
        {negocio.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={negocio.logo_url} alt="" className="mx-auto mb-1 max-h-14 max-w-[60%] object-contain grayscale" />
        )}
        <p className="text-sm font-bold uppercase">{negocio.nombre || "LOMS 360"}</p>
        {negocio.nit && <p>{ID_FISCAL[moneda]} {negocio.nit}</p>}
        {negocio.direccion && <p>{negocio.direccion}</p>}
        {negocio.telefono && <p>Tel. {negocio.telefono}</p>}
      </div>
      <hr className="my-2 border-dashed border-slate-400" />
      <div className="flex justify-between">
        <span>Venta #{venta.numero}</span>
        <span>{f.fechaHoraAnio(venta.fecha)}</span>
      </div>
      {venta.cliente && <p>Cliente: {venta.cliente}</p>}
      {venta.anulada && <p className="mt-1 font-bold">*** VENTA ANULADA ***</p>}
      <hr className="my-2 border-dashed border-slate-400" />
      <table className="w-full">
        <tbody>
          {venta.lineas.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="pr-1">{l.cantidad}×</td>
              <td className="w-full pr-1">{l.nombre}</td>
              <td className="whitespace-nowrap text-right">{f.dinero(l.precio * l.cantidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-2 border-dashed border-slate-400" />
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span><span>{f.dinero(venta.total)}</span>
      </div>
      {venta.pagos.map((p, i) => (
        <div key={i} className="flex justify-between">
          <span>{METODO_PAGO_LABEL[p.metodo as MetodoPagoFarmacia] ?? p.metodo}</span>
          <span>{f.dinero(p.monto)}</span>
        </div>
      ))}
      {venta.vuelto > 0 && (
        <div className="flex justify-between">
          <span>Vuelto</span><span>{f.dinero(venta.vuelto)}</span>
        </div>
      )}
      <hr className="my-2 border-dashed border-slate-400" />
      <p className="text-center text-[10px] text-slate-500">
        Comprobante interno de venta · no es boleta ni factura
      </p>
      <p className="text-center text-[10px] text-slate-500">¡Gracias por su compra!</p>
    </div>
  )

  return (
    <>
      {/* Copia para la impresora: fuera del diálogo, visible solo al imprimir */}
      <div id="ticket-impresion" className="hidden print:fixed print:left-0 print:top-0 print:block print:w-[80mm] print:bg-white print:p-2">
        {cuerpo}
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Comprobante · venta #{venta.numero}</DialogTitle></DialogHeader>
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">{cuerpo}</div>
          <div className="mt-3 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button type="button" className="flex-1 gap-1.5 bg-brand-600 hover:bg-brand-700" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
