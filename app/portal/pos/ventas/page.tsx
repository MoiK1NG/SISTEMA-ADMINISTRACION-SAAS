import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Receipt, Banknote, CreditCard, Smartphone, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}
function fmtHora(ts: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts))
}

const METODO_META: Record<string, { label: string; icon: any; classes: string }> = {
  efectivo:      { label: "Efectivo",      icon: Banknote,   classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  tarjeta:       { label: "Tarjeta",        icon: CreditCard, classes: "bg-blue-50 text-blue-700 border-blue-200"          },
  transferencia: { label: "Transferencia",  icon: Smartphone, classes: "bg-purple-50 text-purple-700 border-purple-200"    },
}

export default async function VentasPosPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0)
  const hace7 = new Date();     hace7.setDate(hace7.getDate() - 7); hace7.setHours(0, 0, 0, 0)

  // KPIs de hoy y últimos 7 días
  const { data: ventas7d } = await supabase
    .from("ventas_pos")
    .select("total, metodo, created_at")
    .eq("agente_id", user.id)
    .gte("created_at", hace7.toISOString())

  const deHoy      = (ventas7d ?? []).filter(v => new Date(v.created_at) >= hoyInicio)
  const totalHoy   = deHoy.reduce((s, v) => s + Number(v.total), 0)
  const total7d    = (ventas7d ?? []).reduce((s, v) => s + Number(v.total), 0)
  const porMetodo  = (["efectivo", "tarjeta", "transferencia"] as const).map(m => ({
    metodo: m,
    total: deHoy.filter(v => v.metodo === m).reduce((s, v) => s + Number(v.total), 0),
  }))

  // Últimas 30 ventas con sus items
  const { data: ventas } = await supabase
    .from("ventas_pos")
    .select("id, subtotal, impuesto, total, metodo, monto_recibido, created_at, items_venta_pos(nombre, cantidad)")
    .eq("agente_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <Link href="/portal/pos"><ArrowLeft className="h-3.5 w-3.5" />Volver al POS</Link>
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <Receipt className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold text-slate-900">Ventas</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hoy</p>
            <p className="mt-1.5 text-xl font-black text-slate-900">{fmt(totalHoy)}</p>
            <p className="text-xs text-slate-400">{deHoy.length} {deHoy.length === 1 ? "venta" : "ventas"}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />7 días
            </p>
            <p className="mt-1.5 text-xl font-black text-slate-900">{fmt(total7d)}</p>
            <p className="text-xs text-slate-400">{ventas7d?.length ?? 0} ventas</p>
          </div>
          {porMetodo.map(({ metodo, total }) => {
            const meta = METODO_META[metodo]
            return (
              <div key={metodo} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <meta.icon className="h-3 w-3" />{meta.label} hoy
                </p>
                <p className="mt-1.5 text-xl font-black text-slate-900">{fmt(total)}</p>
              </div>
            )
          })}
        </div>

        {/* ── Historial ────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <p className="text-sm font-bold text-slate-900">Últimas ventas</p>
            <p className="text-xs text-slate-400 mt-0.5">Las 30 más recientes</p>
          </div>

          {(!ventas || ventas.length === 0) ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-sm font-medium text-slate-700">Sin ventas registradas</p>
              <p className="mt-1 text-xs text-slate-400">Los cobros del POS aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50/50">
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Items</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Método</th>
                    <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">IVA</th>
                    <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ventas.map((v: any) => {
                    const meta = METODO_META[v.metodo] ?? METODO_META.efectivo
                    const items = (v.items_venta_pos ?? []) as { nombre: string; cantidad: number }[]
                    const resumen = items.map(i => `${i.cantidad}× ${i.nombre}`).join(", ")
                    return (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtHora(v.created_at)}</td>
                        <td className="px-5 py-3 text-xs text-slate-700 max-w-md truncate">{resumen || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.classes}`}>
                            <meta.icon className="h-2.5 w-2.5" />{meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-slate-500 tabular-nums">{fmt(Number(v.impuesto))}</td>
                        <td className="px-5 py-3 text-right text-sm font-bold text-slate-900 tabular-nums">{fmt(Number(v.total))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
