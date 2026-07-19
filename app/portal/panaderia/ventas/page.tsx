import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShoppingBag, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NuevaVentaButton } from "./_components/nueva-venta-button"

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso + "T00:00:00"))
}

export default async function VentasPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const today = new Date().toISOString().split("T")[0]
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [{ data: ventasRaw }, { data: productosRaw }] = await Promise.all([
    supabase
      .from("ventas_pan")
      .select("id, fecha, total, notas, items_venta_pan(cantidad, precio_unitario, productos_pan(nombre))")
      .eq("agente_id", user.id)
      .order("fecha", { ascending: false })
      .limit(30),
    supabase
      .from("productos_pan")
      .select("id, nombre, precio_venta, unidad")
      .eq("agente_id", user.id)
      .eq("activo", true)
      .order("nombre"),
  ])

  const ventas   = ventasRaw  ?? []
  const productos = productosRaw ?? []
  const ventasHoy  = ventas.filter(v => v.fecha === today)
  const totalHoy   = ventasHoy.reduce((s, v) => s + Number(v.total), 0)
  const ventas7d   = ventas.filter(v => v.fecha >= hace7)
  const total7d    = ventas7d.reduce((s, v) => s + Number(v.total), 0)

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/panaderia"><ArrowLeft className="h-4 w-4" />Panel</Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <ShoppingBag className="h-5 w-5 text-orange-500" />
          <p className="text-sm font-semibold text-slate-900">Ventas</p>
          <div className="ml-auto">
            <NuevaVentaButton productos={productos as any} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Hoy</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{fmt(totalHoy)}</p>
              <p className="text-[11px] text-slate-400">{ventasHoy.length} ventas</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">7 días</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{fmt(total7d)}</p>
              <p className="text-[11px] text-slate-400">{ventas7d.length} ventas</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Promedio diario</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{fmt(ventas7d.length ? total7d / 7 : 0)}</p>
              <p className="text-[11px] text-slate-400">últimos 7 días</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total registro</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{ventas.length}</p>
              <p className="text-[11px] text-slate-400">ventas históricas</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" /> Historial de ventas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ventas.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <ShoppingBag className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Sin ventas registradas</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fecha</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Productos</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notas</TableHead>
                    <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.map((v: any) => (
                    <TableRow key={v.id} className="border-slate-50 hover:bg-slate-50/70">
                      <TableCell className="pl-6 text-sm text-slate-700">{fmtDate(v.fecha)}</TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[200px]">
                        <p className="truncate">{(v.items_venta_pan ?? []).map((i: any) => `${i.cantidad}× ${i.productos_pan?.nombre}`).join(", ")}</p>
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-400">{v.notas ?? "—"}</TableCell>
                      <TableCell className="pr-6 text-right text-sm font-semibold text-slate-900">{fmt(Number(v.total))}</TableCell>
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
