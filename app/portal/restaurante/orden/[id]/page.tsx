import { requireClient } from "@/lib/supabase/require-client"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, UtensilsCrossed, CheckCircle2, Clock, ChefHat } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AgregarItemButton } from "./_components/agregar-item-button"
import { CerrarOrdenButton } from "./_components/cerrar-orden-button"

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n)
}

const ESTADO_ITEM: Record<string, { label: string; classes: string }> = {
  pendiente:  { label: "Pendiente",  classes: "bg-amber-50  text-amber-700  border-amber-200"    },
  preparando: { label: "Preparando", classes: "bg-blue-50   text-blue-700   border-blue-200"     },
  listo:      { label: "Listo",      classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  entregado:  { label: "Entregado",  classes: "bg-slate-100 text-slate-500  border-slate-200"    },
}

export default async function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: orden } = await supabase
    .from("ordenes_rest")
    .select("id, total, estado, notas, created_at, mesas_rest(numero, capacidad)")
    .eq("id", id).eq("agente_id", user.id).single()

  if (!orden) notFound()

  const { data: itemsRaw } = await supabase
    .from("items_orden_rest")
    .select("id, cantidad, precio_unitario, subtotal, estado, nota, menu_items_rest(nombre)")
    .eq("orden_id", id)
    .order("created_at")

  const { data: menuItems } = await supabase
    .from("menu_items_rest")
    .select("id, nombre, precio, categoria_id, menu_categorias(nombre)")
    .eq("agente_id", user.id).eq("disponible", true).order("nombre")

  const items   = itemsRaw ?? []
  const mesa    = Array.isArray(orden.mesas_rest) ? orden.mesas_rest[0] : orden.mesas_rest
  const abierta = orden.estado === "abierta"

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/restaurante"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Mesas</span></Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/10">
            <UtensilsCrossed className="h-4 w-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Mesa {mesa?.numero ?? "—"}</p>
            <p className="text-[11px] text-slate-400">Orden #{id.slice(0, 8).toUpperCase()}</p>
          </div>
          <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${abierta ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
            {abierta ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {abierta ? "Abierta" : orden.estado}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mesa {mesa?.numero}</h1>
            <p className="text-sm text-slate-500">{items.length} items en la orden</p>
          </div>
          {abierta && (
            <div className="flex items-center gap-2">
              <AgregarItemButton ordenId={id} menuItems={(menuItems ?? []) as any} />
              <CerrarOrdenButton ordenId={id} total={Number(orden.total)} />
            </div>
          )}
        </div>

        {/* Items */}
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-red-500" /> Orden
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <UtensilsCrossed className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Sin items en la orden</p>
                {abierta && <p className="text-xs text-slate-400">Usa "Agregar item" para empezar</p>}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Item</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cant.</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Precio</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Subtotal</TableHead>
                    <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => {
                    const cfg = ESTADO_ITEM[item.estado] ?? ESTADO_ITEM.pendiente
                    return (
                      <TableRow key={item.id} className="border-slate-50 hover:bg-slate-50/70">
                        <TableCell className="pl-6">
                          <p className="text-sm font-medium text-slate-900">{item.menu_items_rest?.nombre ?? "Item"}</p>
                          {item.nota && <p className="text-[10px] text-slate-400">{item.nota}</p>}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{item.cantidad}</TableCell>
                        <TableCell className="text-sm text-slate-600">{fmt(Number(item.precio_unitario))}</TableCell>
                        <TableCell className="text-sm font-semibold text-slate-900">{fmt(Number(item.subtotal))}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${cfg.classes}`}>{cfg.label}</span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Total */}
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-700">Total</span>
              <span className="text-3xl font-bold text-slate-900">{fmt(Number(orden.total))}</span>
            </div>
            {abierta && (
              <div className="mt-4">
                <CerrarOrdenButton ordenId={id} total={Number(orden.total)} fullWidth />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
