import Link from "next/link"
import { Pill, Users, Boxes, ShoppingCart, Calculator, ShieldCheck, ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import { contextoFarmacia, ROL_LABEL } from "@/lib/farmacia/contexto"
import { alertasDeHoy } from "@/lib/farmacia/alertas"
import { ID_FISCAL } from "@/lib/farmacia/formato"
import { AlertasHoy } from "./_components/alertas-hoy"
import { DatosNegocioDialog } from "./_components/datos-negocio-dialog"
import { PrimerosPasos, type PasoInicial } from "./_components/primeros-pasos"
import { SoporteCard } from "./_components/soporte-card"

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

export default async function FarmaciaPage() {
  const { supabase, agenteId, viendoA, negocio, rol, sinPermisoSoporte } = await contextoFarmacia()
  const esGestor = rol === "dueno" || rol === "regente"

  const esDueno = rol === "dueno"
  const contar = (tabla: string) => negocio && esDueno
    ? supabase.from(tabla).select("id", { count: "exact", head: true }).eq("negocio_id", negocio.id)
    : Promise.resolve({ count: null })

  const [{ data: profile }, { data: equipo }, alertas, { count: numProductos }, { count: numCierres }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", agenteId).single(),
    // Equipo (via función: la RLS de profiles no deja ver perfiles ajenos)
    negocio
      ? supabase.rpc("equipo_negocio", { p_negocio: negocio.id })
      : Promise.resolve({ data: [] as any[] }),
    // Alertas del día, en vivo (vencimientos, stock mínimo, crónicos, cuentas)
    negocio
      ? alertasDeHoy(supabase, negocio.id, negocio.moneda, esGestor)
      : Promise.resolve(null),
    // Para "Primeros pasos" del dueño
    contar("productos_farmacia"),
    contar("cierres_caja_farmacia"),
  ])

  // Primeros pasos del dueño: se calculan en vivo y desaparecen al completarse
  // Un admin sin permiso de soporte no ve los cierres: la lista saldría mal
  const primerosPasos: PasoInicial[] | null = negocio && esDueno && !sinPermisoSoporte ? [
    {
      label: "Completa los datos del negocio",
      hecho: Boolean(negocio.nit && negocio.direccion && negocio.telefono),
      ayuda: `${ID_FISCAL[negocio.moneda]}, dirección y teléfono: salen en el comprobante. Usa "Datos del negocio", arriba a la derecha.`,
    },
    {
      label: "Sube el logo de tu farmacia",
      hecho: Boolean(negocio.logo_url),
      ayuda: "Sale en la barra y en el comprobante. También eliges el color, en \"Datos del negocio\".",
    },
    {
      label: "Crea la cuenta de al menos un cajero",
      hecho: (equipo ?? []).some((m: any) => m.rol === "cajero"),
      href:  "/portal/farmacia/equipo",
      ayuda: "En Equipo, con una contraseña inicial que le entregas en persona.",
    },
    {
      label: "Carga tu inventario",
      hecho: (numProductos ?? 0) > 0,
      href:  "/portal/farmacia/inventario",
      ayuda: "Productos con su precio y sus lotes. Si tienes un Excel, pásalo a soporte y lo cargamos.",
    },
    {
      label: "Completa las fechas de vencimiento",
      hecho: (numProductos ?? 0) > 0 && alertas?.sin_fecha === 0,
      href:  "/portal/farmacia/inventario",
      ayuda: alertas?.sin_fecha
        ? `Quedan ${alertas.sin_fecha} productos con lotes sin fecha.`
        : "Cada lote necesita su fecha para el semáforo de vencimientos.",
    },
    {
      label: "Haz tu primer cierre de caja",
      hecho: (numCierres ?? 0) > 0,
      href:  "/portal/farmacia/caja",
      ayuda: "Al terminar el primer turno con ventas.",
    },
  ] : null

  const datosNegocio = negocio
    ? [negocio.nit && `${ID_FISCAL[negocio.moneda]} ${negocio.nit}`, negocio.direccion, negocio.telefono].filter(Boolean).join(" · ")
    : ""

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches"
  const initials = profile?.full_name ? getInitials(profile.full_name) : "U"

  // Módulos por fase — se van encendiendo a medida que se construyen
  const modulos = [
    { label: "Inventario",  desc: "Códigos de barras, lotes, vencimientos y equivalentes", icon: Boxes,        fase: "Disponible", href: "/portal/farmacia/inventario" },
    { label: "Ventas (POS)", desc: "Escaneo, pago mixto y pedidos pendientes",             icon: ShoppingCart, fase: "Disponible", href: "/portal/farmacia/pos" },
    { label: "Caja y finanzas", desc: "Cierre ciego, flujo de caja y márgenes",            icon: Calculator,   fase: "Disponible", href: "/portal/farmacia/finanzas" },
    { label: "Recetas y pacientes", desc: "Libro de control y tratamientos crónicos",        icon: Users,        fase: "Disponible", href: "/portal/farmacia/recetas" },
  ]

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {negocio?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={negocio.logo_url} alt={negocio.nombre}
                   className="h-9 w-9 rounded-xl border border-slate-100 bg-white object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 shadow-sm shadow-brand-500/30"
                   style={negocio?.color ? { backgroundImage: "none", backgroundColor: negocio.color } : undefined}>
                <Pill className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none text-slate-900">
                {negocio?.nombre ?? "Farmacia"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">ERP de farmacia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rol && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <ShieldCheck className="h-3 w-3" />
                {ROL_LABEL[rol]}
              </span>
            )}
            <Avatar className="ml-1 h-8 w-8 ring-2 ring-slate-100">
              <AvatarFallback className="bg-brand-500/10 text-xs font-semibold text-brand-700">{initials}</AvatarFallback>
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
              con el correo de esta cuenta (o que te cree una desde Equipo). Si eres el dueño,
              contacta a la plataforma para dar de alta tu negocio.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">{saludo}, {profile?.full_name?.split(" ")[0] ?? "bienvenido"}</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{negocio.nombre}</h1>
                {datosNegocio && <p className="mt-1 text-xs text-slate-400">{datosNegocio}</p>}
              </div>
              {rol === "dueno" && !viendoA && <DatosNegocioDialog negocio={negocio} />}
            </div>

            {primerosPasos && <PrimerosPasos pasos={primerosPasos} />}

            {sinPermisoSoporte && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <strong>Sin permiso de soporte.</strong> El dueño no autorizó el acceso: ventas, clientes, recetas, caja y
                finanzas están ocultos, y las alertas de pacientes y cuentas por pagar aparecen en cero.
              </p>
            )}

            {rol === "dueno" && !viendoA && <SoporteCard hasta={negocio.soporte_hasta} />}

            {/* ── Alertas de hoy ─────────────────────────────────────────────── */}
            {alertas && (
              <section>
                <h2 className="mb-3 text-sm font-bold text-slate-900">Alertas de hoy</h2>
                <AlertasHoy alertas={alertas} esGestor={esGestor} />
              </section>
            )}

            {/* ── Equipo ─────────────────────────────────────────────────────── */}
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-600" />
                  <h2 className="text-sm font-bold text-slate-900">Equipo</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {(equipo ?? []).length}
                  </span>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-brand-700 hover:text-brand-800">
                  <Link href="/portal/farmacia/equipo">
                    {rol === "dueno" ? "Gestionar" : "Ver equipo"} <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(equipo ?? []).map((m: any) => (
                  <div key={m.miembro_id} className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 py-1 pl-1 pr-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600/10 text-[10px] font-bold text-brand-700">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {modulos.map(m => {
                  const contenido = (
                    <>
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                        <m.icon className="h-4 w-4 text-brand-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">{m.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.desc}</p>
                      <span className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        m.href ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"
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
