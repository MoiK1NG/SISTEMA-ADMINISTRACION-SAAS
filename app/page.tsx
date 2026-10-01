import Link from "next/link"
import {
  ArrowRight, ChevronRight, CheckCircle2,
  Layers, Building2, Eye, Sparkles,
  Pill, ShoppingCart, Boxes, Calculator, FileText, HeartPulse,
  Crown, FlaskConical, UserRound,
} from "lucide-react"

// ─── Contenido (voz de marca: resultados de negocio, frases cortas) ──────────
const DIFERENCIADORES = [
  { icon: Layers,    title: "Todo en una plataforma",  desc: "Clientes, ventas, inventario y finanzas conectados. Sin sistemas sueltos ni planillas paralelas." },
  { icon: Building2, title: "Para tu industria",       desc: "Cada portal está armado para la operación real de ese negocio, no es una plantilla genérica." },
  { icon: Eye,       title: "Visión 360° real",        desc: "Una sola fuente de verdad para ventas, finanzas y operación. Lo que ves es lo que pasa." },
  { icon: Sparkles,  title: "Simple de usar",          desc: "Tu equipo empieza a trabajar el primer día, sin capacitaciones largas." },
]

const FARMACIA = [
  { icon: ShoppingCart, text: "Ventas con lector de código de barras y pago mixto" },
  { icon: Boxes,        text: "Inventario por lotes, con semáforo de vencimientos" },
  { icon: Calculator,   text: "Cierre de caja ciego y finanzas del dueño" },
  { icon: FileText,     text: "Libro de recetas controladas" },
  { icon: HeartPulse,   text: "Seguimiento de pacientes crónicos" },
]

const ROLES = [
  { icon: Crown,        rol: "Dueño",   desc: "Ve todo el negocio: finanzas, márgenes, equipo." },
  { icon: FlaskConical, rol: "Regente", desc: "Gestiona inventario, compras y controla la operación." },
  { icon: UserRound,    rol: "Cajero",  desc: "Vende, atiende pedidos y cierra su caja." },
]

const PROXIMOS = ["Panadería", "Restaurante", "Punto de venta", "Préstamos", "Canchas deportivas"]

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 antialiased">

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="LOMS 360, inicio" className="flex items-center">
            <img src="/brand/loms360-logo.svg" alt="LOMS 360" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
              Iniciar sesión
            </Link>
            <Link href="/signup" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]">
              Crear cuenta <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        {/* Órbitas: el sistema gráfico de la marca, como recurso secundario */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full border border-brand-100" />
          <div className="absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full border border-brand-100" />
          <div className="absolute right-[150px] top-[88px] h-3 w-3 rounded-full bg-brand-400" />
          <div className="absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-brand-50 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-16 lg:flex-row">

            <div className="flex-1 text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                <span className="text-xs font-semibold text-brand-700">CRM y ERP en una sola plataforma</span>
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-brand-900 sm:text-6xl lg:text-7xl">
                Todo tu negocio.<br />
                <span className="text-brand-600">Una visión 360°.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-slate-500 lg:mx-0">
                LOMS 360 conecta clientes, ventas, inventario y finanzas en un solo lugar,
                para que dirijas tu negocio con información real y al día.
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 active:scale-[0.98]"
                >
                  Crear cuenta <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-base font-medium text-slate-700 transition-all hover:bg-slate-50">
                  Ya tengo cuenta <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>

              <p className="mt-5 text-sm text-slate-400">La solución 360 para tu negocio</p>
            </div>

            {/* Vista ilustrativa del panel (datos de ejemplo) */}
            <div className="w-full max-w-lg flex-1">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-brand-900/10">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                  <img src="/brand/loms360-icono.svg" alt="" className="h-6 w-6" />
                  <span className="text-xs font-medium text-slate-400">Farmacia · hoy</span>
                </div>
                <div className="bg-[#F7F9FC] p-5">
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    {[
                      { label: "Ventas de hoy", val: "48", color: "text-brand-600" },
                      { label: "Por vencer",    val: "6",  color: "text-amber-600" },
                      { label: "Caja",          val: "Cuadró", color: "text-emerald-600" },
                    ].map(c => (
                      <div key={c.label} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="mb-1 text-[10px] text-slate-400">{c.label}</p>
                        <p className={`text-xl font-bold ${c.color}`}>{c.val}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Actividad reciente</p>
                  <div className="space-y-2">
                    {[
                      { t: "Venta #1042 · pago mixto",            s: "Cajero",  c: "bg-brand-50 text-brand-700" },
                      { t: "Lote L-2409A pasa a venta",            s: "Regente", c: "bg-slate-100 text-slate-600" },
                      { t: "Paciente crónico: renovar tratamiento", s: "Aviso",   c: "bg-amber-50 text-amber-700" },
                    ].map(a => (
                      <div key={a.t} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                        <span className="flex-1 text-xs font-semibold text-slate-800">{a.t}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.c}`}>{a.s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DIFERENCIADORES ──────────────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Por qué LOMS 360</span>
            <h2 className="mt-2 text-4xl font-bold leading-tight text-brand-900 sm:text-5xl">
              Control total,<br />en un solo lugar
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DIFERENCIADORES.map(d => {
              const Icon = d.icon
              return (
                <div key={d.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                    <Icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <h3 className="mb-1.5 font-bold text-brand-900">{d.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{d.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PORTAL FARMACIA ──────────────────────────────────────────────────── */}
      <section className="bg-[#F7F9FC] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-16 lg:flex-row">
            <div className="flex-1">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Disponible hoy</span>
              <h2 className="mt-2 text-4xl font-bold leading-tight text-brand-900">
                Portal de farmacia
              </h2>
              <p className="mt-4 leading-relaxed text-slate-500">
                Pensado con farmacias reales: lo que se vende, lo que vence, lo que entra
                y lo que queda en caja, con cada persona del equipo en su rol.
              </p>
              <ul className="mt-6 space-y-3">
                {FARMACIA.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-slate-700">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                      <Icon className="h-4 w-4 text-brand-600" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Próximos portales</p>
                <div className="flex flex-wrap gap-2">
                  {PROXIMOS.map(p => (
                    <span key={p} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">{p}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Roles */}
            <div className="w-full max-w-md flex-1">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-brand-900/5">
                <div className="mb-5 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900">
                    <Pill className="h-4 w-4 text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-brand-900">Un equipo, tres roles</p>
                    <p className="text-xs text-slate-400">Cada uno ve y hace lo que le corresponde</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {ROLES.map(({ icon: Icon, rol, desc }) => (
                    <div key={rol} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-[#F7F9FC] px-4 py-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{rol}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  El dueño agrega a su equipo con el correo de cada persona.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA NAVY ─────────────────────────────────────────────────────────── */}
      <section className="bg-brand-900 py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <img src="/brand/loms360-logo-oscuro.svg" alt="LOMS 360" className="mx-auto mb-8 h-10 w-auto" />
          <h2 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
            Tu negocio, siempre bajo control.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-brand-200">
            Crea tu cuenta y, si tu negocio ya usa LOMS 360, pídele al dueño que te agregue a su equipo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-brand-900 transition-all hover:bg-brand-50">
              Crear cuenta <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center rounded-2xl border border-brand-700 px-7 py-3.5 text-sm font-medium text-brand-100 transition-colors hover:bg-brand-800">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <img src="/brand/loms360-logo.svg" alt="LOMS 360" className="h-7 w-auto" />
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} LOMS 360 · La solución 360 para tu negocio</p>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/login" className="transition-colors hover:text-slate-700">Iniciar sesión</Link>
            <Link href="/signup" className="transition-colors hover:text-slate-700">Crear cuenta</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
