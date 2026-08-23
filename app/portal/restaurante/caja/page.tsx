import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, DollarSign, Receipt, TrendingUp, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PortalNav } from "@/components/portal/portal-nav"

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}
function fmtTime(ts: string) {
  return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts))
}

const METODO_ICON: Record<string, any> = {
  efectivo:      DollarSign,
  tarjeta:       CreditCard,
  transferencia: TrendingUp,
}

export default async function CajaPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const today  = new Date().toISOString().split("T")[0]
  const hace7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const { data: pagosHoyRaw } = await supabase
    .from("pagos_rest")
    .select("id, monto, metodo, created_at, ordenes_rest(mesas_rest(numero))")
    .eq("agente_id", user.id)
    .gte("created_at", `${today}T00:00:00`)
    .order("created_at", { ascending: false })

  const { data: pagos7dRaw } = await supabase
    .from("pagos_rest")
    .select("monto, metodo")
    .eq("agente_id", user.id)
    .gte("created_at", `${hace7d}T00:00:00`)

  const pagosHoy = pagosHoyRaw ?? []
  const pagos7d  = pagos7dRaw  ?? []

  const totalHoy = pagosHoy.reduce((s, p) => s + Number(p.monto), 0)
  const total7d  = pagos7d.reduce((s, p) => s + Number(p.monto), 0)

  const porMetodo = pagos7d.reduce<Record<string, number>>((acc, p) => {
    acc[p.metodo] = (acc[p.metodo] ?? 0) + Number(p.monto); return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/restaurante"><ArrowLeft className="h-4 w-4" />Mesas</Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <DollarSign className="h-5 w-5 text-red-600" />
          <p className="text-sm font-semibold text-slate-900">Caja del día</p>
        </div>
      </header>
      <PortalNav portal="restaurante" />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-slate-100 bg-white shadow-sm col-span-2 sm:col-span-1">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Ventas hoy</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{fmt(totalHoy)}</p>
              <p className="text-[11px] text-slate-400">{pagosHoy.length} cierres</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100 bg-white shadow-sm col-span-2 sm:col-span-1">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Últimos 7 días</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{fmt(total7d)}</p>
              <p className="text-[11px] text-slate-400">promedio {fmt(total7d / 7)} / día</p>
            </CardContent>
          </Card>
          {Object.entries(porMetodo).map(([metodo, monto]) => {
            const Icon = METODO_ICON[metodo] ?? Receipt
            return (
              <Card key={metodo} className="border-slate-100 bg-white shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-red-500" />
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 capitalize">{metodo}</p>
                  </div>
                  <p className="text-xl font-bold text-slate-900">{fmt(monto)}</p>
                  <p className="text-[11px] text-slate-400">{Math.round((monto / total7d) * 100)}% del total</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Cierre del día */}
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-red-500" /> Cierres de hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pagosHoy.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Receipt className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Sin cierres hoy todavía</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hora</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mesa</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Método</TableHead>
                    <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagosHoy.map((p: any) => {
                    const mesa = Array.isArray(p.ordenes_rest?.mesas_rest) ? p.ordenes_rest.mesas_rest[0] : p.ordenes_rest?.mesas_rest
                    const Icon = METODO_ICON[p.metodo] ?? Receipt
                    return (
                      <TableRow key={p.id} className="border-slate-50 hover:bg-slate-50/70">
                        <TableCell className="pl-6 text-sm text-slate-700">{fmtTime(p.created_at)}</TableCell>
                        <TableCell className="text-sm text-slate-700">Mesa {mesa?.numero ?? "—"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-slate-600">
                            <Icon className="h-3 w-3" />{p.metodo}
                          </span>
                        </TableCell>
                        <TableCell className="pr-6 text-right text-sm font-semibold text-slate-900">{fmt(Number(p.monto))}</TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="border-slate-50 bg-red-50/50">
                    <TableCell colSpan={3} className="pl-6 text-sm font-semibold text-slate-700">Total del día</TableCell>
                    <TableCell className="pr-6 text-right text-base font-bold text-red-600">{fmt(totalHoy)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
