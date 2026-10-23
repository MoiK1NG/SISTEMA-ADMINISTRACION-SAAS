"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, ImageUp, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useNegocioUI } from "@/components/farmacia/negocio-provider"
import { ID_FISCAL } from "@/lib/farmacia/formato"
import { COLOR_LOMS, LOGO_MAX_BYTES, LOGO_TIPOS, PALETA_NEGOCIO } from "@/lib/farmacia/marca"
import { actualizarNegocio, cambiarColorNegocio, quitarLogoNegocio, subirLogoNegocio } from "../actions"

export interface DatosNegocio {
  nombre:    string
  nit:       string | null
  direccion: string | null
  telefono:  string | null
  logo_url:  string | null
  color:     string | null
}

/**
 * El dueño corrige nombre, identificador tributario, dirección y teléfono del
 * negocio, y elige su logo y su color (se guardan al instante, aparte del
 * formulario). La etiqueta del identificador depende del país (RUT en Chile,
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
  const [marcaPendiente, startMarca] = useTransition()
  const archivo = useRef<HTMLInputElement>(null)

  function marca(fn: () => Promise<unknown>) {
    setError(null)
    startMarca(async () => {
      try { await fn(); router.refresh() }
      catch (e: any) { setError(e?.message ?? "No se pudo guardar") }
    })
  }

  function elegirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    if (!(LOGO_TIPOS as readonly string[]).includes(f.type)) { setError("El logo tiene que ser PNG, JPG o WebP"); return }
    if (f.size > LOGO_MAX_BYTES) { setError("El logo no puede pesar más de 500 KB"); return }
    const datos = new FormData()
    datos.append("logo", f)
    marca(() => subirLogoNegocio(datos))
  }

  const colorActual = negocio.color ?? COLOR_LOMS

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

            {/* ── Logo y color: se guardan al instante ────────────────────── */}
            <div className={`space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 ${marcaPendiente ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {negocio.logo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={negocio.logo_url} alt="Logo del negocio" className="h-full w-full object-contain" />
                    : <Building2 className="h-5 w-5 text-slate-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Logo</p>
                  <p className="text-xs text-slate-500">PNG, JPG o WebP, hasta 500 KB. Sale en la barra y en el comprobante.</p>
                  <div className="mt-1.5 flex gap-2">
                    <input ref={archivo} type="file" accept={LOGO_TIPOS.join(",")} className="hidden" onChange={elegirLogo} />
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                            disabled={marcaPendiente} onClick={() => archivo.current?.click()}>
                      {marcaPendiente ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageUp className="h-3 w-3" />}
                      {negocio.logo_url ? "Cambiar" : "Subir logo"}
                    </Button>
                    {negocio.logo_url && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500"
                              disabled={marcaPendiente} onClick={() => marca(() => quitarLogoNegocio())}>
                        <Trash2 className="h-3 w-3" />Quitar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-800">Color</p>
                <div className="flex flex-wrap gap-2">
                  {[{ color: COLOR_LOMS, nombre: "Azul LOMS 360" }, ...PALETA_NEGOCIO].map(c => {
                    const elegido = c.color === colorActual
                    return (
                      <button key={c.color} type="button" title={c.nombre} disabled={marcaPendiente}
                              onClick={() => !elegido && marca(() => cambiarColorNegocio(c.color === COLOR_LOMS ? null : c.color))}
                              className={`flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition ${elegido ? "ring-2 ring-slate-800" : "hover:scale-110"}`}
                              style={{ backgroundColor: c.color }}>
                        {elegido && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
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
