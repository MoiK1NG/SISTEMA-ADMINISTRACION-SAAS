"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, SlidersHorizontal, ChevronRight, AlertTriangle, CheckCircle2, Clock, CircleDot, TrendingDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PagarCobroButton } from "./pagar-cobro-button"

export interface CobroRow {
  id: string
  descripcion: string
  monto_total: number
  monto_pagado: number
  saldo_pendiente: number
  estado: string
  fecha_vencimiento: string | null
  created_at: string
  cliente: { nombre: string } | null
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso))
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

const ESTADO: Record<string, { label: string; icon: any; classes: string }> = {
  pendiente: { label: "Pendiente", icon: Clock,         classes: "bg-amber-50  text-amber-700  border-amber-200"    },
  parcial:   { label: "Parcial",   icon: TrendingDown,  classes: "bg-sky-50    text-sky-700    border-sky-200"      },
  pagado:    { label: "Pagado",    icon: CheckCircle2,  classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  vencido:   { label: "Vencido",   icon: AlertTriangle, classes: "bg-rose-50   text-rose-700   border-rose-200"     },
  cancelado: { label: "Cancelado", icon: CircleDot,     classes: "bg-slate-100 text-slate-500  border-slate-200"    },
}

const ACTIVOS = ["pendiente", "parcial", "vencido"]

export function CobrosTable({ cobros }: { cobros: CobroRow[] }) {
  const [search, setSearch]   = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")

  const filtrados = cobros.filter((c) => {
    const nombre = c.cliente?.nombre?.toLowerCase() ?? ""
    const desc   = c.descripcion.toLowerCase()
    const matchSearch = nombre.includes(search.toLowerCase()) || desc.includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase())
    const matchEstado = filtroEstado === "todos" || c.estado === filtroEstado
    return matchSearch && matchEstado
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar por cliente o descripción…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-white border-slate-200 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate-400 shrink-0" />
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="h-9 w-40 bg-white border-slate-200 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-slate-400 sm:ml-auto">{filtrados.length} de {cobros.length}</p>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Search className="h-8 w-8 text-slate-200 mb-3" />
          <p className="text-sm text-slate-500">Sin resultados</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-slate-50 hover:bg-transparent">
              <TableHead className="pl-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cliente</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monto</TableHead>
              <TableHead className="hidden sm:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">Saldo</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vencimiento</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado</TableHead>
              <TableHead className="pr-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((c) => {
              const cfg    = ESTADO[c.estado] ?? ESTADO.pendiente
              const Icon   = cfg.icon
              const nombre = c.cliente?.nombre ?? "Sin cliente"
              const activo = ACTIVOS.includes(c.estado)

              return (
                <TableRow key={c.id} className={`border-slate-50 hover:bg-slate-50/70 transition-colors ${c.estado === "vencido" ? "bg-rose-50/20" : ""}`}>
                  <TableCell className="pl-2">
                    <Link href={`/portal/cobros/${c.id}`} className="flex items-center gap-3 group">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-medium">{getInitials(nombre)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 group-hover:text-emerald-700 transition-colors truncate">{nombre}</p>
                        <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{c.descripcion}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold text-slate-900">{fmt(c.monto_total)}</span>
                    {c.monto_pagado > 0 && <p className="text-[10px] text-emerald-600">Pagado: {fmt(c.monto_pagado)}</p>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className={`text-sm font-medium ${activo ? "text-rose-600" : "text-slate-400"}`}>{activo ? fmt(c.saldo_pendiente) : "—"}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-slate-600">
                    {c.fecha_vencimiento ? fmtDate(c.fecha_vencimiento) : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cfg.classes}`}>
                      <Icon className="h-3 w-3" />{cfg.label}
                    </span>
                  </TableCell>
                  <TableCell className="pr-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {activo && <PagarCobroButton cobroId={c.id} saldoPendiente={c.saldo_pendiente} />}
                      <Link href={`/portal/cobros/${c.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
