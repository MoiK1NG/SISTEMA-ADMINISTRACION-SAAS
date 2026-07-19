"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { crearMesa } from "../../actions"

interface Mesa { id: string; numero: number; capacidad: number; estado: string }

const ESTADO_COLOR: Record<string, string> = {
  libre:     "bg-emerald-50  border-emerald-200 text-emerald-700",
  ocupada:   "bg-red-50      border-red-200      text-red-700",
  reservada: "bg-amber-50   border-amber-200    text-amber-700",
  cerrada:   "bg-slate-100  border-slate-200    text-slate-500",
}

export function ConfiguracionManager({ mesas }: { mesas: Mesa[] }) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [isPending, start]    = useTransition()
  const [numero, setNumero]   = useState("")
  const [capacidad, setCap]   = useState("4")
  const [bulkCount, setBulk]  = useState("5")
  const [bulkCap, setBulkCap] = useState("4")
  const [bulkOpen, setBulkOpen] = useState(false)

  function handleCreate() {
    start(async () => {
      await crearMesa(Number(numero), Number(capacidad))
      setOpen(false); setNumero(""); setCap("4"); router.refresh()
    })
  }

  function handleBulk() {
    start(async () => {
      const start_num = mesas.length > 0 ? Math.max(...mesas.map(m => m.numero)) + 1 : 1
      for (let i = 0; i < Number(bulkCount); i++) {
        await crearMesa(start_num + i, Number(bulkCap))
      }
      setBulkOpen(false); router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />Agregar varias mesas
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader><DialogTitle>Agregar mesas en lote</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Cantidad de mesas</Label>
                <Input type="number" min="1" max="50" value={bulkCount} onChange={e => setBulk(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Capacidad por mesa</Label>
                <Input type="number" min="1" max="20" value={bulkCap} onChange={e => setBulkCap(e.target.value)} />
              </div>
              <p className="text-xs text-slate-400">Los números se asignarán automáticamente continuando desde la última mesa.</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>Cancelar</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleBulk}>
                  {isPending ? "Creando…" : `Crear ${bulkCount} mesas`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 gap-1.5">
              <Plus className="h-3.5 w-3.5" />Nueva mesa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader><DialogTitle>Agregar mesa</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Número de mesa</Label>
                <Input type="number" min="1" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ej: 7" />
              </div>
              <div className="space-y-1.5">
                <Label>Capacidad (personas)</Label>
                <Input type="number" min="1" max="20" value={capacidad} onChange={e => setCap(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={isPending || !numero} onClick={handleCreate}>
                  {isPending ? "…" : "Crear"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {mesas.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <LayoutGrid className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-lg font-semibold text-slate-700">Sin mesas configuradas</p>
          <p className="text-sm text-slate-400">Agrega mesas para ver el mapa del restaurante</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {mesas.map(m => (
            <div key={m.id} className={`rounded-xl border-2 p-3 text-center ${ESTADO_COLOR[m.estado] ?? ESTADO_COLOR.libre}`}>
              <p className="text-2xl font-bold">{m.numero}</p>
              <p className="text-[10px] mt-0.5 font-medium capitalize">{m.estado}</p>
              <p className="text-[10px] opacity-60">{m.capacidad} pers.</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Leyenda de estados</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(ESTADO_COLOR).map(([estado, cls]) => (
            <span key={estado} className={`rounded-full border px-3 py-1 text-[11px] font-medium capitalize ${cls}`}>{estado}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
