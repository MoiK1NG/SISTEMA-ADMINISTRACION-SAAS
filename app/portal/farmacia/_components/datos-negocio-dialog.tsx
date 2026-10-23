"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useNegocioUI } from "@/components/farmacia/negocio-provider"
import { ID_FISCAL } from "@/lib/farmacia/formato"
import { actualizarNegocio } from "../actions"

export interface DatosNegocio {
  nombre:    string
  nit:       string | null
  direccion: string | null
  telefono:  string | null
}

/**
 * El dueño corrige nombre, identificador tributario, dirección y teléfono del
 * negocio. La etiqueta del identificador depende del país (RUT en Chile,
 * NIT en Colombia). Solo lo ve el dueño fuera del modo "ver como".
 */
export function DatosNegocioDialog({ negocio }: { negocio: DatosNegocio }) {
  const router = useRouter()
  const { moneda } = useNegocioUI()
  const idFiscal = ID_FISCAL[moneda]
  const [open, setOpen]   = useState(false)
  const [form, setForm]   = useState({
    nombre: negocio.nombre, nit: negocio.nit ?? "", direccion: negocio.direccion ?? "", telefono: negocio.telefono ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function abrir() {
    setForm({ nombre: negocio.nombre, nit: negocio.nit ?? "", direccion: negocio.direccion ?? "", telefono: negocio.telefono ?? "" })
    setError(null)
    setOpen(true)
  }

  function guardar() {
    setError(null)
    start(async () => {
      try {
        await actualizarNegocio(form)
        setOpen(false)
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo guardar") }
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={abrir} className="gap-1.5 text-xs text-slate-500 hover:text-slate-800">
        <Building2 className="h-3.5 w-3.5" />
        Datos del negocio
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Datos del negocio</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input autoFocus value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{idFiscal}</Label>
              <Input placeholder={moneda === "CLP" ? "76.123.456-7" : "900.123.456-1"} value={form.nit}
                     onChange={e => setForm(f => ({ ...f, nit: e.target.value }))} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <p className="text-xs text-slate-400">
              La moneda ({moneda}) y el IVA por defecto los configura el equipo de LOMS 360.
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-brand-600 hover:bg-brand-700" onClick={guardar} disabled={isPending || !form.nombre.trim()}>
                {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando…</> : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
