import { requireClient } from "@/lib/supabase/require-client"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Banknote, User, Calendar, CheckCircle2, Clock, AlertTriangle, Receipt } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PagarCobroButton } from "../_components/pagar-cobro-button"

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO",{ style:"currency",currency:"DOP",minimumFractionDigits:0 }).format(n)
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-DO",{ day:"2-digit",month:"short",year:"numeric" }).format(new Date(iso))
}
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0,2)
}

const ESTADO: Record<string,{ label:string; icon:any; classes:string }> = {
  pendiente: { label:"Pendiente", icon:Clock,         classes:"bg-amber-50  text-amber-700  border-amber-200"    },
  parcial:   { label:"Parcial",   icon:AlertTriangle, classes:"bg-sky-50    text-sky-700    border-sky-200"      },
  pagado:    { label:"Pagado",    icon:CheckCircle2,  classes:"bg-emerald-50 text-emerald-700 border-emerald-200" },
  vencido:   { label:"Vencido",   icon:AlertTriangle, classes:"bg-rose-50   text-rose-700   border-rose-200"     },
  cancelado: { label:"Cancelado", icon:Clock,         classes:"bg-slate-100 text-slate-500  border-slate-200"    },
}

export default async function CobroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: cobro } = await supabase
    .from("cobros")
    .select("id, descripcion, monto_total, monto_pagado, saldo_pendiente, estado, fecha_vencimiento, notas, created_at, clientes_cobro(id,nombre,cedula,telefono,direccion)")
    .eq("id", id).eq("agente_id", user.id).single()

  if (!cobro) notFound()

  const { data: pagosRaw } = await supabase
    .from("pagos_cobro")
    .select("id, monto, fecha, nota, created_at")
    .eq("cobro_id", id)
    .order("created_at", { ascending: false })

  const pagos = (pagosRaw ?? []).map(p => ({ ...p, monto: Number(p.monto) }))
  const cliente   = Array.isArray(cobro.clientes_cobro) ? cobro.clientes_cobro[0] : cobro.clientes_cobro
  const estadoCfg = ESTADO[cobro.estado] ?? ESTADO.pendiente
  const EstadoIcon = estadoCfg.icon
  const activo    = ["pendiente","parcial","vencido"].includes(cobro.estado)
  const progreso  = cobro.monto_total > 0 ? Math.round((Number(cobro.monto_pagado) / Number(cobro.monto_total)) * 100) : 0

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/cobros"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Cobros</span></Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10">
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{cobro.descripcion}</p>
            <p className="text-[11px] text-slate-400 font-mono">{id.slice(0,8).toUpperCase()}</p>
          </div>
          <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${estadoCfg.classes}`}>
            <EstadoIcon className="h-3 w-3" />{estadoCfg.label}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Cards resumen */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label:"Total cobro",    value: fmt(Number(cobro.monto_total)),    color:"text-slate-900" },
            { label:"Total cobrado",  value: fmt(Number(cobro.monto_pagado)),   color:"text-emerald-700" },
            { label:"Saldo pendiente",value: fmt(Number(cobro.saldo_pendiente)),color: activo ? "text-rose-600" : "text-slate-400" },
          ].map(k => (
            <Card key={k.label} className="border-slate-100 bg-white shadow-sm">
              <CardContent className="pt-5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color} mt-1`}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progreso */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Progreso de cobro</span><span>{progreso}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width:`${progreso}%` }} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Datos cliente */}
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="h-4 w-4" /> Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-emerald-600/10 text-emerald-700 font-semibold">{getInitials(cliente?.nombre ?? "?")}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{cliente?.nombre}</p>
                  {cliente?.cedula && <p className="text-xs text-slate-400">{cliente.cedula}</p>}
                </div>
              </div>
              {cliente?.telefono  && <p className="text-xs text-slate-600"><span className="text-slate-400">Tel: </span>{cliente.telefono}</p>}
              {cliente?.direccion && <p className="text-xs text-slate-600"><span className="text-slate-400">Dir: </span>{cliente.direccion}</p>}
              <div className="border-t border-slate-50 pt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between"><span className="text-slate-400">Creado</span><span>{fmtDate(cobro.created_at)}</span></div>
                {cobro.fecha_vencimiento && (
                  <div className="flex justify-between"><span className="text-slate-400">Vence</span><span className={cobro.estado==="vencido"?"text-rose-600 font-medium":""}>{fmtDate(cobro.fecha_vencimiento)}</span></div>
                )}
              </div>
              {cobro.notas && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{cobro.notas}</p>}
            </CardContent>
          </Card>

          {/* Acción pago */}
          <Card className="border-slate-100 bg-white shadow-sm lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Cobro pendiente
              </CardTitle>
              <PagarCobroButton cobroId={id} saldoPendiente={Number(cobro.saldo_pendiente)} />
            </CardHeader>
            <CardContent>
              {!activo ? (
                <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-4 border border-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Cobro {cobro.estado}</p>
                    <p className="text-xs text-emerald-600">No hay saldo pendiente</p>
                  </div>
                </div>
              ) : (
                <div className={`rounded-lg px-4 py-4 border ${cobro.estado==="vencido"?"bg-rose-50 border-rose-200":"bg-amber-50 border-amber-100"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-medium uppercase tracking-wider ${cobro.estado==="vencido"?"text-rose-500":"text-amber-500"}`}>{estadoCfg.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${cobro.estado==="vencido"?"text-rose-900":"text-amber-900"}`}>{fmt(Number(cobro.saldo_pendiente))}</p>
                    </div>
                    {cobro.fecha_vencimiento && (
                      <div className="text-right">
                        <p className={`text-xs ${cobro.estado==="vencido"?"text-rose-500":"text-amber-500"}`}>Vence</p>
                        <p className={`text-sm font-semibold ${cobro.estado==="vencido"?"text-rose-700":"text-amber-700"}`}>{fmtDate(cobro.fecha_vencimiento)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Historial pagos */}
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900">
              Historial de pagos <span className="ml-2 text-xs font-normal text-slate-400">{pagos.length} registros</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pagos.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Receipt className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Sin pagos registrados aún</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fecha</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monto</TableHead>
                    <TableHead className="pr-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.map(p => (
                    <TableRow key={p.id} className="border-slate-50 hover:bg-slate-50/70">
                      <TableCell className="pl-6 text-sm text-slate-900">{fmtDate(p.fecha)}</TableCell>
                      <TableCell><span className="text-sm font-semibold text-emerald-700">{fmt(p.monto)}</span></TableCell>
                      <TableCell className="pr-6 text-sm text-slate-500">{p.nota ?? <span className="text-slate-300">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
