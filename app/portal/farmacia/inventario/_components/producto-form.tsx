"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  crearProductoFarmacia, editarProductoFarmacia,
  crearProveedorFarmacia, crearLaboratorioFarmacia,
} from "../../actions"
import type { FilaProducto, CatalogoItem } from "./inventario-farmacia"

const CATEGORIAS = [
  "analgésicos", "antibióticos", "antiinflamatorios", "antigripales",
  "gastrointestinales", "dermatológicos", "vitaminas", "cuidado personal",
  "bebés", "otros",
]

const FORM_VACIO = {
  codigo_barras: "", nombre: "", principio_activo: "", concentracion: "",
  presentacion: "", laboratorio_id: "", proveedor_id: "", categoria: "otros",
  registro_invima: "", precio_venta: 0, costo: 0, requiere_receta: false, activo: true,
}

interface Props {
  open:         boolean
  onOpenChange: (v: boolean) => void
  producto:     FilaProducto | null
  proveedores:  CatalogoItem[]
  laboratorios: CatalogoItem[]
}

export function ProductoFormDialog({ open, onOpenChange, producto, proveedores, laboratorios }: Props) {
  const router = useRouter()
  const [form, setForm]   = useState(FORM_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  // Alta rápida de proveedor / laboratorio sin salir del formulario
  const [nuevoProv, setNuevoProv] = useState<string | null>(null)
  const [nuevoLab,  setNuevoLab]  = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setForm(producto ? {
        codigo_barras:    producto.codigo_barras ?? "",
        nombre:           producto.nombre,
        principio_activo: producto.principio_activo ?? "",
        concentracion:    producto.concentracion ?? "",
        presentacion:     producto.presentacion ?? "",
        laboratorio_id:   producto.laboratorio_id ?? "",
        proveedor_id:     producto.proveedor_id ?? "",
        categoria:        producto.categoria,
        registro_invima:  producto.registro_invima ?? "",
        precio_venta:     producto.precio_venta,
        costo:            producto.costo ?? 0,
        requiere_receta:  producto.requiere_receta,
        activo:           producto.activo,
      } : FORM_VACIO)
    }
  }, [open, producto])

  function handleGuardar() {
    setError(null)
    start(async () => {
      try {
        const payload = {
          ...form,
          laboratorio_id: form.laboratorio_id || null,
          proveedor_id:   form.proveedor_id || null,
        }
        if (producto) await editarProductoFarmacia(producto.id, payload)
        else          await crearProductoFarmacia(payload)
        onOpenChange(false)
        router.refresh()
      } catch (e: any) {
        setError(e?.message ?? "No se pudo guardar")
      }
    })
  }

  function altaRapida(tipo: "prov" | "lab", nombre: string) {
    if (!nombre.trim()) return
    start(async () => {
      try {
        if (tipo === "prov") {
          const r = await crearProveedorFarmacia(nombre)
          setForm(f => ({ ...f, proveedor_id: r.id }))
          setNuevoProv(null)
        } else {
          const r = await crearLaboratorioFarmacia(nombre)
          setForm(f => ({ ...f, laboratorio_id: r.id }))
          setNuevoLab(null)
        }
        router.refresh()
      } catch (e: any) {
        setError(e?.message ?? "No se pudo crear")
      }
    })
  }

  const selectClases = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{producto ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

          {/* Código de barras primero: es el flujo natural con lector USB */}
          <div className="space-y-1.5">
            <Label>Código de barras</Label>
            <Input
              autoFocus={!producto}
              placeholder="Escanea o escribe el código…"
              value={form.codigo_barras}
              onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
              className="font-mono"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label>Nombre comercial *</Label>
              <Input
                placeholder="Ej: Dolex Forte"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Concentración</Label>
              <Input
                placeholder="500 mg"
                value={form.concentracion}
                onChange={e => setForm(f => ({ ...f, concentracion: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Principio activo</Label>
            <Input
              placeholder="Ej: Acetaminofén — habilita las sugerencias de equivalentes"
              value={form.principio_activo}
              onChange={e => setForm(f => ({ ...f, principio_activo: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Presentación</Label>
              <Input
                placeholder="Caja x 30 tabletas"
                value={form.presentacion}
                onChange={e => setForm(f => ({ ...f, presentacion: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <select
                className={selectClases}
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              >
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Laboratorio y proveedor, con alta inline */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Laboratorio</Label>
              {nuevoLab === null ? (
                <div className="flex gap-1.5">
                  <select
                    className={selectClases}
                    value={form.laboratorio_id}
                    onChange={e => setForm(f => ({ ...f, laboratorio_id: e.target.value }))}
                  >
                    <option value="">— Sin laboratorio —</option>
                    {laboratorios.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 px-2.5"
                          onClick={() => setNuevoLab("")} title="Crear laboratorio">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Input autoFocus placeholder="Nombre del laboratorio" value={nuevoLab}
                         onChange={e => setNuevoLab(e.target.value)}
                         onKeyDown={e => e.key === "Enter" && altaRapida("lab", nuevoLab)} />
                  <Button type="button" size="sm" className="h-10 shrink-0 bg-teal-600 px-3 hover:bg-teal-700"
                          disabled={isPending} onClick={() => altaRapida("lab", nuevoLab)}>OK</Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              {nuevoProv === null ? (
                <div className="flex gap-1.5">
                  <select
                    className={selectClases}
                    value={form.proveedor_id}
                    onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}
                  >
                    <option value="">— Sin proveedor —</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 px-2.5"
                          onClick={() => setNuevoProv("")} title="Crear proveedor">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Input autoFocus placeholder="Nombre del proveedor" value={nuevoProv}
                         onChange={e => setNuevoProv(e.target.value)}
                         onKeyDown={e => e.key === "Enter" && altaRapida("prov", nuevoProv)} />
                  <Button type="button" size="sm" className="h-10 shrink-0 bg-teal-600 px-3 hover:bg-teal-700"
                          disabled={isPending} onClick={() => altaRapida("prov", nuevoProv)}>OK</Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Registro INVIMA</Label>
              <Input
                placeholder="INVIMA 2020M-…"
                value={form.registro_invima}
                onChange={e => setForm(f => ({ ...f, registro_invima: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Precio de venta (COP) *</Label>
              <Input
                type="number" min="0" step="50"
                value={form.precio_venta || ""}
                onChange={e => setForm(f => ({ ...f, precio_venta: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo (COP)</Label>
              <Input
                type="number" min="0" step="50"
                value={form.costo || ""}
                onChange={e => setForm(f => ({ ...f, costo: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="rounded" checked={form.requiere_receta}
                     onChange={e => setForm(f => ({ ...f, requiere_receta: e.target.checked }))} />
              Requiere receta médica
            </label>
            {producto && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="rounded" checked={form.activo}
                       onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                Activo (visible para vender)
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              onClick={handleGuardar}
              disabled={isPending || !form.nombre.trim()}
            >
              {isPending
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando…</>
                : producto ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
