import Link from "next/link"
import { ArrowLeft, Users, Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClientesManager, type ClienteData } from "./_components/clientes-manager"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { resolverAgente } from "@/lib/admin-context"

export default async function ClientesPage() {
  // agenteId es el dueño de los datos que se muestran: el propio usuario, o
  // el cliente que un admin está inspeccionando en modo lectura.
  const { supabase, agenteId, viendoA } = await resolverAgente()

  // Clientes del agente con conteo de préstamos
  const { data: clientesRaw } = await supabase
    .from("clientes")
    .select("id, nombre, cedula, telefono, direccion, prestamos(id, estado)")
    .eq("agente_id", agenteId)
    .order("nombre")

  const clientes: ClienteData[] = (clientesRaw ?? []).map((c) => ({
    id:        c.id,
    nombre:    c.nombre,
    cedula:    c.cedula   ?? null,
    telefono:  c.telefono ?? null,
    direccion: c.direccion ?? null,
    prestamos_count: Array.isArray(c.prestamos) ? c.prestamos.length : 0,
  }))

  const activos = clientes.filter((c) => c.prestamos_count > 0).length

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600 hover:text-slate-900">
            <Link href="/portal/prestamos">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Cartera</span>
            </Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Gestión de Clientes</p>
        </div>
      </header>
      <PortalNav portal="prestamos" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total clientes", value: clientes.length, icon: Users,    color: "text-blue-600",   bg: "bg-blue-50"    },
            { label: "Con préstamos",  value: activos,         icon: Landmark, color: "text-purple-600", bg: "bg-purple-50"  },
            { label: "Sin préstamos",  value: clientes.length - activos, icon: Users, color: "text-slate-600", bg: "bg-slate-50" },
          ].map((k) => (
            <Card key={k.label} className="border-slate-100 bg-white shadow-sm">
              <CardContent className="pt-4 flex items-center gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 leading-none">{k.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lista */}
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900">
              Todos los clientes
              <span className="ml-2 text-xs font-normal text-slate-400">{clientes.length} registros</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ClientesManager clientes={clientes} />
          </CardContent>
        </Card>

        <div className="h-6" />
      </main>
    </div>
  )
}
