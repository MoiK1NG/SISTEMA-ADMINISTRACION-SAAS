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
  Lock,
  TrendingUp,
  Layers,
} from "lucide-react"

// ─── Data ────────────────────────────────────────────────────────────────────
const STATS = [
  { value: "3+",    label: "Portales especializados" },
  { value: "100%",  label: "Datos en tiempo real" },
  { value: "RLS",   label: "Seguridad por fila" },
  { value: "0 min", label: "Tiempo de configuración" },
]

const PORTALES = [
  {
    icon: UtensilsCrossed,
    color: "#F59E0B",
    name: "Punto de Venta",
    desc: "POS táctil optimizado para tablets. Catálogo por categorías, carrito inteligente, múltiples métodos de pago e IVA automático.",
    tags: ["Restaurantes", "Panaderías", "Cafeterías"],
  },
  {
    icon: Dumbbell,
    color: "#3B82F6",
    name: "Canchas Sintéticas",
    desc: "Calendario de reservas con vista por hora. Validación de solapamiento en base de datos, estadísticas de ocupación por cancha.",
    tags: ["Deportes", "Reservas", "Horarios"],
  },
  {
    icon: Banknote,
    color: "#10B981",
    name: "Portal de Préstamos",
    desc: "Gestión de cartera completa con interés sobre saldo, generación automática de cuotas y cobro en campo con historial de pagos.",
    tags: ["Microcrédito", "Cuotas", "Cartera"],
  },
]

const FEATURES = [
  { icon: Shield,    title: "Seguridad RLS",         desc: "Row Level Security en Supabase. Cada usuario ve únicamente sus propios datos." },
  { icon: Zap,       title: "Server Components",     desc: "Las páginas renderizan en el servidor. Carga instantánea, sin parpadeos." },
  { icon: BarChart3, title: "KPIs en tiempo real",   desc: "Métricas calculadas en PostgreSQL. Sin procesos batch, sin retrasos." },
  { icon: Lock,      title: "Control de acceso",     desc: "Asigna portales por membresía. El middleware verifica cada ruta automáticamente." },
  { icon: TrendingUp,title: "Reportes integrados",   desc: "Vistas precalculadas por agente, fecha y producto. Listas para exportar." },
  { icon: Layers,    title: "Multi-negocio",         desc: "Un panel para todos tus negocios. Cambia entre portales sin cerrar sesión." },
]

// ─── Small UI mockup components (pure HTML/CSS via dangerouslySetInnerHTML won't work in RSC)
// We'll build them inline with Tailwind + inline styles

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-base">SaaS Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/signup" className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all active:scale-[0.98]" style={{ background: "#1d4ed8" }}>
              Comenzar gratis <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-10 blur-3xl" style={{ background: "#3b82f6" }} />
          <div className="absolute top-20 -left-20 h-72 w-72 rounded-full opacity-8 blur-3xl" style={{ background: "#1d4ed8" }} />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* Text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-semibold text-blue-700">Multi-portal · Un solo panel de control</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
                Administra<br />
                <span style={{ color: "#1d4ed8" }}>todos tus</span><br />
                negocios
              </h1>

              <p className="mt-6 text-lg text-slate-500 leading-relaxed max-w-md mx-auto lg:mx-0">
                POS, canchas, préstamos y más. Cada portal adaptado a su industria,
                con seguridad empresarial real y datos en tiempo real.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-base font-bold text-white shadow-lg transition-all active:scale-[0.98]"
                  style={{ background: "#1d4ed8", boxShadow: "0 4px 24px rgba(29,78,216,0.35)" }}
                >
                  Empieza gratis <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-base font-medium text-slate-700 hover:bg-slate-50 transition-all">
                  Tengo cuenta <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>

              <p className="mt-5 text-sm text-slate-400">Sin tarjeta de crédito · Acceso inmediato</p>
            </div>

            {/* Hero UI mockup */}
            <div className="flex-1 w-full max-w-lg">
              <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden" style={{ boxShadow: "0 32px 80px rgba(29,78,216,0.12)" }}>
                {/* Top bar */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <div className="h-2 w-2 rounded-full bg-yellow-400" />
                    <div className="h-2 w-2 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-4 h-6 rounded-lg bg-slate-100" />
                </div>
                {/* Dashboard preview */}
                <div className="p-5 bg-slate-50">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Portales", val: "3", color: "#1d4ed8" },
                      { label: "Días restantes", val: "28", color: "#10b981" },
                      { label: "Plan", val: "Pro", color: "#f59e0b" },
                    ].map(c => (
                      <div key={c.label} className="rounded-2xl bg-white border border-slate-100 p-3 shadow-sm">
                        <p className="text-[10px] text-slate-400 mb-1">{c.label}</p>
                        <p className="text-xl font-black" style={{ color: c.color }}>{c.val}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Tus portales</p>
                  <div className="space-y-2">
                    {[
                      { name: "Punto de Venta", emoji: "🍽️", color: "#fef3c7", tc: "#92400e" },
                      { name: "Canchas Sintéticas", emoji: "⚽", color: "#dbeafe", tc: "#1e40af" },
                      { name: "Portal de Préstamos", emoji: "💰", color: "#d1fae5", tc: "#065f46" },
                    ].map(p => (
                      <div key={p.name} className="flex items-center gap-3 rounded-xl bg-white border border-slate-100 px-3 py-2.5 shadow-sm">
                        <span className="text-base">{p.emoji}</span>
                        <span className="flex-1 text-xs font-semibold text-slate-800">{p.name}</span>
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: p.color, color: p.tc }}>Activo</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS — dark blue ────────────────────────────────────────────────── */}
      <section style={{ background: "#0f172a" }} className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-4xl sm:text-5xl font-black text-white mb-2">{s.value}</p>
                <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORTALES ─────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#1d4ed8" }}>Portales disponibles</span>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black text-slate-900 leading-tight">
              Herramientas hechas<br />para cada industria
            </h2>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto">
              Cada portal está construido de cero para su industria. Sin adaptaciones genéricas.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {PORTALES.map((p) => {
              const Icon = p.icon
              return (
                <div key={p.name} className="group rounded-3xl border border-slate-100 bg-white p-7 shadow-sm transition-all duration-200 hover:shadow-xl hover:-translate-y-1" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: p.color + "20" }}>
                    <Icon className="h-7 w-7" style={{ color: p.color }} />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-slate-900">{p.name}</h3>
                  <p className="mb-5 text-sm text-slate-500 leading-relaxed">{p.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.tags.map(tag => (
                      <span key={tag} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: p.color + "15", color: p.color }}>
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

      {/* ── POS MOCKUP SECTION ─────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: "#f8fafc" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Text */}
            <div className="flex-1 order-2 lg:order-1">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f59e0b" }}>Portal POS</span>
              <h2 className="mt-2 text-4xl font-black text-slate-900 leading-tight">
                Cobra más rápido<br />desde cualquier tablet
              </h2>
              <p className="mt-4 text-slate-500 leading-relaxed">
                Interfaz táctil optimizada para restaurantes y panaderías. Catálogo con búsqueda,
                categorías, carrito con IVA automático y 3 métodos de cobro.
              </p>
              <ul className="mt-6 space-y-3">
                {["Catálogo visual con emojis y badges de cantidad", "IVA 19% calculado automáticamente", "Efectivo con cálculo de vuelto instantáneo", "Tarjeta y transferencia integrados"].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* POS mini mockup */}
            <div className="flex-1 order-1 lg:order-2 w-full max-w-md">
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3" style={{ background: "#fffbeb" }}>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)" }}>
                      <UtensilsCrossed className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Punto de Venta</span>
                  </div>
                  <span className="text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">● En línea</span>
                </div>
                <div className="grid grid-cols-3 gap-2 p-4">
                  {[
                    { e: "🍞", n: "Almojábana", p: "$2.500" },
                    { e: "☕", n: "Café", p: "$3.000" },
                    { e: "🥐", n: "Croissant", p: "$4.500" },
                    { e: "🍩", n: "Buñuelo", p: "$1.800" },
                    { e: "🥪", n: "Sandwich", p: "$8.500" },
                    { e: "🍕", n: "Pizza", p: "$12.000" },
                  ].map(pr => (
                    <div key={pr.n} className="rounded-xl border border-slate-100 p-2.5 text-center">
                      <div className="text-2xl mb-1">{pr.e}</div>
                      <p className="text-[10px] font-semibold text-slate-700 leading-tight">{pr.n}</p>
                      <p className="text-[10px] font-bold mt-0.5" style={{ color: "#f59e0b" }}>{pr.p}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between" style={{ background: "#f8fafc" }}>
                  <div>
                    <p className="text-[10px] text-slate-400">Total</p>
                    <p className="text-lg font-black text-slate-900">$24.800</p>
                  </div>
                  <div className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: "#10b981" }}>
                    💳 Cobrar
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#1d4ed8" }}>Tecnología</span>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black text-slate-900">
              Infraestructura<br />de nivel empresarial
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-blue-100 hover:shadow-md" style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#eff6ff" }}>
                    <Icon className="h-5 w-5" style={{ color: "#1d4ed8" }} />
                  </div>
                  <h3 className="mb-1.5 font-bold text-slate-900">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA DARK ─────────────────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: "#0f172a" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight">
                Un plan.<br />
                <span style={{ color: "#60a5fa" }}>Todos los portales.</span>
              </h2>
              <p className="mt-4 leading-relaxed" style={{ color: "#94a3b8" }}>
                Sin sorpresas ni costos ocultos. Un precio mensual que te da acceso
                a todo lo que tu negocio necesita para operar.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Acceso a todos los portales del plan",
                  "Sin límite de transacciones",
                  "Actualizaciones automáticas incluidas",
                  "Soporte técnico prioritario",
                  "Backup automático diario",
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "#cbd5e1" }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#34d399" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full lg:w-80 shrink-0 rounded-3xl p-8" style={{ background: "#1e293b", border: "1px solid #334155" }}>
              <p className="text-sm mb-1" style={{ color: "#94a3b8" }}>Empieza desde</p>
              <p className="text-6xl font-black text-white">$0
                <span className="text-xl font-normal" style={{ color: "#64748b" }}>/mes</span>
              </p>
              <p className="text-xs mt-1 mb-7" style={{ color: "#475569" }}>
                Escala cuando tu negocio crezca
              </p>

              <Link href="/signup" className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 text-sm font-bold text-slate-900 bg-white hover:bg-slate-100 transition-all mb-3">
                Crear cuenta gratis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="flex items-center justify-center w-full rounded-2xl py-3 text-sm font-medium transition-colors" style={{ color: "#64748b" }}>
                Ya tengo cuenta →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: "#1d4ed8" }}>
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-700">SaaS Admin</span>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} · Todos los derechos reservados</p>

          <div className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/login" className="hover:text-slate-700 transition-colors">Iniciar sesión</Link>
            <Link href="/signup" className="hover:text-slate-700 transition-colors">Registrarse</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
