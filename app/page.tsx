import Link from "next/link"
import {
  ArrowRight,
  Building2,
  UtensilsCrossed,
  Dumbbell,
  Banknote,
  Shield,
  Zap,
  BarChart3,
  Users,
  CheckCircle2,
  ChevronRight,
} from "lucide-react"

// ─── Portal cards data ────────────────────────────────────────────────────────
const PORTALES = [
  {
    icon: UtensilsCrossed,
    color: "from-amber-500 to-orange-500",
    shadow: "shadow-amber-500/20",
    bg: "bg-amber-50",
    text: "text-amber-700",
    name: "Punto de Venta",
    desc: "POS táctil para restaurantes y panaderías. Catálogo, carrito, cobro con ITBIS.",
    tags: ["Restaurantes", "Panaderías", "Cafeterías"],
  },
  {
    icon: Dumbbell,
    color: "from-sky-500 to-blue-600",
    shadow: "shadow-sky-500/20",
    bg: "bg-sky-50",
    text: "text-sky-700",
    name: "Canchas Sintéticas",
    desc: "Calendario de reservas por hora con control de solapamiento y estadísticas.",
    tags: ["Deportes", "Reservas", "Horarios"],
  },
  {
    icon: Banknote,
    color: "from-emerald-500 to-green-600",
    shadow: "shadow-emerald-500/20",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    name: "Portal de Préstamos",
    desc: "Gestión de cartera con interés sobre saldo, cuotas automáticas y cobro en campo.",
    tags: ["Finanzas", "Microcrédito", "Cuotas"],
  },
]

const FEATURES = [
  {
    icon: Shield,
    title: "Seguridad con RLS",
    desc: "Row Level Security en Supabase. Cada usuario accede únicamente a sus datos, sin excepciones.",
  },
  {
    icon: Zap,
    title: "Acceso instantáneo",
    desc: "Los portales cargan en milisegundos gracias a Server Components y Edge Functions.",
  },
  {
    icon: BarChart3,
    title: "KPIs en tiempo real",
    desc: "Métricas de ingresos, ocupación y cartera calculadas directamente en la base de datos.",
  },
  {
    icon: Users,
    title: "Multi-usuario",
    desc: "Administra agentes, asigna portales y controla membresías desde un panel central.",
  },
]

const PLAN_ITEMS = [
  "Acceso a todos los portales del plan",
  "Soporte técnico prioritario",
  "Actualizaciones incluidas",
  "Sin límite de transacciones",
  "Backup automático diario",
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 shadow-sm">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">SaaS Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition-all active:scale-[0.98]"
            >
              Comenzar gratis
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-b from-slate-100 to-transparent opacity-60 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-24 text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-600">Multi-portal · Un solo panel</span>
          </div>

          <h1 className="mx-auto max-w-3xl text-5xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
            La plataforma para{" "}
            <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 bg-clip-text text-transparent">
              emprendedores dominicanos
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-500 leading-relaxed">
            Administra tus negocios desde un único panel. POS, canchas, préstamos y más —
            cada portal adaptado a tu industria, con seguridad empresarial real.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-700 transition-all active:scale-[0.98]"
            >
              Empieza ahora — es gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-base font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              Ya tengo cuenta
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-slate-400">
            Sin tarjeta de crédito · Acceso inmediato · Cancela cuando quieras
          </p>
        </div>
      </section>

      {/* ── PORTALES ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Portales disponibles</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Herramientas hechas para tu negocio
            </h2>
            <p className="mt-3 text-slate-500 max-w-lg mx-auto">
              Cada portal está construido específicamente para su industria. Sin adaptaciones, sin compromiso.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {PORTALES.map((p) => {
              const Icon = p.icon
              return (
                <div
                  key={p.name}
                  className="group relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                >
                  {/* Icon */}
                  <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${p.color} shadow-lg ${p.shadow}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>

                  <h3 className="mb-2 text-lg font-bold text-slate-900">{p.name}</h3>
                  <p className="mb-4 text-sm text-slate-500 leading-relaxed">{p.desc}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map(tag => (
                      <span key={tag} className={`rounded-full ${p.bg} ${p.text} px-2.5 py-1 text-xs font-medium`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Por qué elegirnos</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Infraestructura de nivel empresarial
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mb-1.5 font-semibold text-slate-900">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA / PLAN ────────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12 shadow-2xl shadow-slate-900/30">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">

              {/* Left */}
              <div className="flex-1">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Todo incluido
                </p>
                <h2 className="text-3xl font-black text-white leading-tight">
                  Un plan. Todos los portales.
                </h2>
                <p className="mt-3 text-slate-400 leading-relaxed">
                  Sin sorpresas. Un precio mensual que te da acceso a todo lo que tu negocio necesita.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {PLAN_ITEMS.map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: CTA card */}
              <div className="w-full lg:w-72 shrink-0 rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
                <p className="text-sm text-slate-400 mb-1">Desde</p>
                <p className="text-5xl font-black text-white">
                  $0
                  <span className="text-lg font-normal text-slate-400">/mes</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">para empezar · actualiza cuando crezcas</p>

                <Link
                  href="/signup"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-bold text-slate-900 shadow-lg hover:bg-slate-100 transition-all active:scale-[0.98]"
                >
                  Crear cuenta gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="mt-2.5 inline-flex w-full items-center justify-center rounded-xl py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Ya tengo cuenta →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700">SaaS Admin</span>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} · Hecho con ❤️ para emprendedores dominicanos</p>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/login" className="hover:text-slate-700 transition-colors">Iniciar sesión</Link>
            <Link href="/signup" className="hover:text-slate-700 transition-colors">Registrarse</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
