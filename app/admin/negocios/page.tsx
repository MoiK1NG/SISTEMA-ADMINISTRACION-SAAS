import { requireClient } from "@/lib/supabase/require-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import { MONEDAS, type Moneda } from "@/lib/farmacia/formato"
import { AltaNegocioDialog, type PlanAlta } from "@/components/admin/alta-negocio-dialog"

interface FilaNegocio {
  id:        string
  nombre:    string
  pais:      string
  creado:    string
  dueno:     string
  duenoMail: string
  plan:      string | null
  vence:     string | null
  regentes:  number
  cajeros:   number
  maxReg:    number | null
  maxCaj:    number | null
  productos: number | null
}

/**
 * Negocios de la plataforma con datos NO sensibles: quién es el dueño, su
 * plan, cuánta gente tiene contra el límite del plan y cuántos productos
 * cargó. No lee ventas, clientes ni finanzas del negocio.
 */
export default async function NegociosPage() {
  const supabase = await requireClient()
  const hoy = new Date().toISOString().split("T")[0]

  const [{ data: negocios }, { data: miembros }, { data: planes }] = await Promise.all([
    supabase.from("negocios").select("id, nombre, moneda, created_at").order("created_at", { ascending: false }),
    supabase.from("miembros_negocio").select("negocio_id, user_id, rol"),
    supabase.from("membership_plans")
      .select("id, name, duration_days, price, is_active, max_regentes, max_cajeros")
      .order("price", { ascending: true }),
  ])

  const duenoIds = [...new Set((miembros ?? []).filter(m => m.rol === "dueno").map(m => m.user_id))]

  const [{ data: perfiles }, { data: membresias }, conteos] = await Promise.all([
    duenoIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", duenoIds)
      : Promise.resolve({ data: [] as any[] }),
    duenoIds.length
      ? supabase.from("memberships")
          .select("user_id, end_date, membership_plans:plan_id(name, max_regentes, max_cajeros)")
          .in("user_id", duenoIds).eq("status", "active").gte("end_date", hoy)
          .order("end_date", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    // Un count por negocio: son pocos y cada uno usa el índice por negocio
    Promise.all((negocios ?? []).map(n =>
      supabase.from("productos_farmacia").select("id", { count: "exact", head: true }).eq("negocio_id", n.id)
        .then(r => [n.id, r.count ?? null] as const)
    )),
  ])

  const perfilPorId = new Map((perfiles ?? []).map((p: any) => [p.id, p]))
  const membresiaPorDueno = new Map<string, any>()
  for (const m of membresias ?? []) if (!membresiaPorDueno.has(m.user_id)) membresiaPorDueno.set(m.user_id, m)
  const productosPorNegocio = new Map(conteos)

  const filas: FilaNegocio[] = (negocios ?? []).map(n => {
    const equipo = (miembros ?? []).filter(m => m.negocio_id === n.id)
    const duenoId = equipo.find(m => m.rol === "dueno")?.user_id
    const perfil = duenoId ? perfilPorId.get(duenoId) : null
    const mem = duenoId ? membresiaPorDueno.get(duenoId) : null
    const plan = mem ? (Array.isArray(mem.membership_plans) ? mem.membership_plans[0] : mem.membership_plans) : null
    return {
      id:        n.id,
      nombre:    n.nombre,
      pais:      MONEDAS[(n.moneda as Moneda) ?? "COP"]?.pais ?? n.moneda,
      creado:    n.created_at,
      dueno:     perfil?.full_name || perfil?.email || "Sin dueño",
      duenoMail: perfil?.email ?? "",
      plan:      plan?.name ?? null,
      vence:     mem?.end_date ?? null,
      regentes:  equipo.filter(m => m.rol === "regente").length,
      cajeros:   equipo.filter(m => m.rol === "cajero").length,
      maxReg:    plan?.max_regentes ?? null,
      maxCaj:    plan?.max_cajeros ?? null,
      productos: productosPorNegocio.get(n.id) ?? null,
    }
  })

  const planesAlta: PlanAlta[] = (planes ?? [])
    .filter((p: any) => p.is_active)
    .map((p: any) => ({
      id: p.id, nombre: p.name, dias: p.duration_days,
      maxRegentes: p.max_regentes ?? null, maxCajeros: p.max_cajeros ?? null,
    }))

  const cupo = (n: number, max: number | null) => (max === null ? `${n}` : `${n} de ${max}`)
  const fecha = (d: string) => new Date(d + (d.includes("T") ? "" : "T00:00:00"))
    .toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Negocios</h1>
          <p className="text-sm text-muted-foreground">
            Da de alta un negocio con su dueño, su plan y su equipo inicial
          </p>
        </div>
        <AltaNegocioDialog planes={planesAlta} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> {filas.length} {filas.length === 1 ? "negocio" : "negocios"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay negocios</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4">Negocio</th>
                    <th className="py-2 pr-4">Dueño</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4 text-right">Regentes</th>
                    <th className="py-2 pr-4 text-right">Cajeros</th>
                    <th className="py-2 text-right">Productos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filas.map(n => (
                    <tr key={n.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{n.nombre}</p>
                        <p className="text-xs text-muted-foreground">{n.pais} · desde {fecha(n.creado)}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p>{n.dueno}</p>
                        <p className="text-xs text-muted-foreground">{n.duenoMail}</p>
                      </td>
                      <td className="py-3 pr-4">
                        {n.plan ? (
                          <>
                            <p>{n.plan}</p>
                            <p className="text-xs text-muted-foreground">vence {fecha(n.vence!)}</p>
                          </>
                        ) : (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Sin membresía vigente</span>
                        )}
                      </td>
                      <td className={`py-3 pr-4 text-right tabular-nums ${n.maxReg !== null && n.regentes > n.maxReg ? "font-bold text-amber-600" : ""}`}>
                        {cupo(n.regentes, n.maxReg)}
                      </td>
                      <td className={`py-3 pr-4 text-right tabular-nums ${n.maxCaj !== null && n.cajeros > n.maxCaj ? "font-bold text-amber-600" : ""}`}>
                        {cupo(n.cajeros, n.maxCaj)}
                      </td>
                      <td className="py-3 text-right tabular-nums">{n.productos ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
