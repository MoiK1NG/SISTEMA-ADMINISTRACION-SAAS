import Link from "next/link"
import { Pill, Users, Boxes, ShoppingCart, Calculator, ShieldCheck, ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia, ROL_LABEL } from "@/lib/farmacia/contexto"

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

export default async function FarmaciaPage() {
  const { supabase, agenteId, viendoA, negocio, rol } = await contextoFarmacia()

  const { data: profile } = await supabase
    .from("profiles").select("full_name, email").eq("id", agenteId).single()

  // Equipo (via función: la RLS de profiles no deja ver perfiles ajenos)
  const { data: equipo } = negocio
    ? await supabase.rpc("equipo_negocio", { p_negocio: negocio.id })
    : { data: [] }

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches"
  const initials = profile?.full_name ? getInitials(profile.full_name) : "U"

  // Módulos por fase — se van encendiendo a medida que se construyen
  const modulos = [
    { label: "Inventario",  desc: "Códigos de barras, lotes, vencimientos y equivalentes", icon: Boxes,        fase: "Disponible", href: "/portal/farmacia/inventario" },
    { label: "Ventas (POS)", desc: "Escaneo, pago mixto y pedidos pendientes",             icon: ShoppingCart, fase: "Fase 2", href: null },
    { label: "Caja y finanzas", desc: "Cierre ciego, flujo de caja y márgenes",            icon: Calculator,   fase: "Fase 3", href: null },
  ]

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/30">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none text-slate-900">
                {negocio?.nombre ?? "Farmacia"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">ERP de farmacia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rol && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                <ShieldCheck className="h-3 w-3" />
                {ROL_LABEL[rol]}
              </span>
            )}
            <Avatar className="ml-1 h-8 w-8 ring-2 ring-slate-100">
              <AvatarFallback className="bg-teal-500/10 text-xs font-semibold text-teal-700">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

        {!negocio ? (
          /* ── Sin negocio asignado ─────────────────────────────────────────── */
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Pill className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-900">No perteneces a ninguna farmacia</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              Si trabajas en una farmacia registrada, pide al dueño que te agregue al equipo
              con el correo de tu cuenta. Si eres el dueño, contacta a la plataforma para
              dar de alta tu negocio.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-slate-500">{saludo}, {profile?.full_name?.split(" ")[0] ?? "bienvenido"}</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{negocio.nombre}</h1>
            </div>

            {/* ── Equipo ─────────────────────────────────────────────────────── */}
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-600" />
                  <h2 className="text-sm font-bold text-slate-900">Equipo</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {(equipo ?? []).length}
                  </span>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-teal-700 hover:text-teal-800">
                  <Link href="/portal/farmacia/equipo">
                    {rol === "dueno" ? "Gestionar" : "Ver equipo"} <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(equipo ?? []).map((m: any) => (
                  <div key={m.miembro_id} className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 py-1 pl-1 pr-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600/10 text-[10px] font-bold text-teal-700">
                      {(m.nombre || "?")[0].toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-slate-700">{m.nombre}</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {ROL_LABEL[m.rol as keyof typeof ROL_LABEL] ?? m.rol}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Módulos en camino ──────────────────────────────────────────── */}
            <section>
              <h2 className="mb-4 text-sm font-bold text-slate-900">Módulos del sistema</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {modulos.map(m => {
                  const contenido = (
                    <>
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
                        <m.icon className="h-4 w-4 text-teal-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">{m.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.desc}</p>
                      <span className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        m.href ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-400"
                      }`}>
                        {m.fase}
                      </span>
                    </>
                  )
                  return m.href ? (
                    <Link key={m.label} href={m.href}
                          className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                      {contenido}
                    </Link>
                  ) : (
                    <div key={m.label} className="rounded-2xl border border-dashed border-slate-200 bg-white p-5">
                      {contenido}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
