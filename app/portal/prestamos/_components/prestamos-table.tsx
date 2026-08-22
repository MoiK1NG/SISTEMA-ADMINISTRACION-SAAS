"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, SlidersHorizontal, CheckCircle2, AlertTriangle, Clock, CircleDot, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RegistrarPagoButton } from "../[id]/_components/registrar-pago-button"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type EstadoPrestamo = "pendiente" | "activo" | "al_dia" | "en_mora" | "pagado" | "cancelado"

export interface PrestamoRowData {
  id: string
  monto_principal: number
  saldo_pendiente: number
  estado: EstadoPrestamo
  fecha_vencimiento: string
  created_at: string
  clientes: { nombre: string } | null
  proxima_cuota: { fecha_vencimiento: string; monto_cuota: number } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso))
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

const ESTADO: Record<EstadoPrestamo, { label: string; icon: React.ElementType; classes: string }> = {
  pendiente: { label: "Pendiente", icon: Clock,         classes: "bg-amber-50  text-amber-700  border-amber-200"    },
  activo:    { label: "Activo",    icon: CheckCircle2,  classes: "bg-blue-50   text-blue-700   border-blue-200"     },
  al_dia:    { label: "Al día",    icon: CheckCircle2,  classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  en_mora:   { label: "En mora",   icon: AlertTriangle, classes: "bg-rose-50   text-rose-700   border-rose-200"     },
  pagado:    { label: "Pagado",    icon: CircleDot,     classes: "bg-slate-100 text-slate-600  border-slate-200"    },
  cancelado: { label: "Cancelado", icon: CircleDot,     classes: "bg-slate-100 text-slate-500  border-slate-200"    },
}

const ACTIVOS: EstadoPrestamo[] = ["activo", "al_dia", "en_mora", "pendiente"]

// ─── Componente ───────────────────────────────────────────────────────────────
export function PrestamosTable({ prestamos }: { prestamos: PrestamoRowData[] }) {
  const [search, setSearch]     = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos")

  const filtrados = prestamos.filter((p) => {
    const nombre  = p.clientes?.nombre?.toLowerCase() ?? ""
    const matchSearch = nombre.includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
    const matchEstado = estadoFiltro === "todos" || p.estado === estadoFiltro
    return matchSearch && matchEstado
  })

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white border-slate-200 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate-400 shrink-0" />
          <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
            <SelectTrigger className="h-9 w-40 bg-white border-slate-200 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="al_dia">Al día</SelectItem>
              <SelectItem value="en_mora">En mora</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-slate-400 sm:ml-auto">
          {filtrados.length} de {prestamos.length} préstamos
        </p>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-8 w-8 text-slate-200 mb-3" />
          <p className="text-sm font-medium text-slate-600">Sin resultados</p>
          <p className="text-xs text-slate-400 mt-1">Intenta con otro cliente o cambia el filtro de estado</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-slate-50 hover:bg-transparent">
              <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cliente</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monto</TableHead>
              <TableHead className="hidden sm:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">Próxima cuota</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">Saldo</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado</TableHead>
              <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((p) => {
              const cfg    = ESTADO[p.estado] ?? ESTADO.activo
              const Icon   = cfg.icon
              const nombre = p.clientes?.nombre ?? "Sin nombre"
              const estaActivo = ACTIVOS.includes(p.estado)

              return (
                <TableRow key={p.id} className="border-slate-50 transition-colors hover:bg-slate-50/70">
                  {/* Cliente */}
                  <TableCell className="pl-6">
                    <Link href={`/portal/prestamos/${p.id}`} className="flex items-center gap-3 group">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-medium">
                          {getInitials(nombre)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-slate-900 leading-none group-hover:text-primary transition-colors">
                          {nombre}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400 font-mono">
                          {p.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </Link>
                  </TableCell>

                  {/* Monto */}
                  <TableCell>
                    <span className="text-sm font-semibold text-slate-900">{fmt(p.monto_principal)}</span>
                  </TableCell>

                  {/* Próxima cuota */}
                  <TableCell className="hidden sm:table-cell">
                    {!estaActivo ? (
                      <span className="text-sm text-slate-400">—</span>
                    ) : p.proxima_cuota ? (
                      <div>
                        <p className={`text-sm ${p.estado === "en_mora" ? "text-rose-600 font-medium" : "text-slate-700"}`}>
                          {fmtDate(p.proxima_cuota.fecha_vencimiento)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{fmt(p.proxima_cuota.monto_cuota)}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Sin cuotas</span>
                    )}
                  </TableCell>

                  {/* Saldo */}
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-slate-600">{fmt(p.saldo_pendiente)}</span>
                  </TableCell>

                  {/* Estado */}
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cfg.classes}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {estaActivo && p.proxima_cuota && (
                        <RegistrarPagoButton
                          prestamoId={p.id}
                          proximaCuota={{ monto_cuota: p.proxima_cuota.monto_cuota }}
                        />
                      )}
                      <Link
                        href={`/portal/prestamos/${p.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="Ver detalle"
                      >
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
