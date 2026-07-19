"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Building2, Loader2, AlertTriangle, TrendingUp, Shield, Zap,
  BarChart3, Lock, ChevronRight,
} from "lucide-react"

const FEATURES = [
  { icon: BarChart3,  text: "Dashboards en tiempo real"             },
  { icon: Shield,     text: "Seguridad con Row Level Security"       },
  { icon: TrendingUp, text: "KPIs y reportes automáticos"            },
  { icon: Zap,        text: "Múltiples portales en un solo lugar"    },
]

export default function LoginPage() {
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) { setError("Supabase no configurado."); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError("Correo o contraseña incorrectos."); setLoading(false); return }
    window.location.href = "/dashboard"
  }

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 max-w-sm w-full text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <p className="font-semibold text-slate-800">Configuración requerida</p>
          <p className="text-sm text-slate-500">Agrega <code className="bg-white rounded px-1">NEXT_PUBLIC_SUPABASE_URL</code> y <code className="bg-white rounded px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Panel izquierdo — identidad de marca ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#1d4ed8] p-12 text-white">
        {/* Círculos decorativos */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-blue-600/5 border border-blue-400/10" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">5Minutos</p>
            <p className="text-[11px] text-blue-200/80 uppercase tracking-widest">Sistema Empresarial</p>
          </div>
        </div>

        {/* Mensaje central */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Plataforma multi-portal activa
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight">
              Gestiona tu negocio<br />
              <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                sin complicaciones
              </span>
            </h1>
            <p className="text-base text-blue-100/70 leading-relaxed max-w-sm">
              Un sistema completo para préstamos, cobros, restaurantes, panaderías y más.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                  <Icon className="h-3.5 w-3.5 text-blue-300" />
                </div>
                <span className="text-sm text-blue-100/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-blue-300/50">
            © {new Date().getFullYear()} 5Minutos · Todos los derechos reservados
          </p>
        </div>
      </div>

      {/* ── Panel derecho — formulario ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 sm:px-12">
        {/* Logo móvil */}
        <div className="lg:hidden mb-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
            <Building2 className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">5Minutos</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* Encabezado */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bienvenido de vuelta</h2>
            <p className="mt-1.5 text-sm text-slate-500">Inicia sesión para acceder a tus portales</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Correo electrónico
              </Label>
              <Input
                id="email" type="email" autoComplete="email"
                placeholder="tu@correo.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required disabled={loading}
                className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Contraseña
                </Label>
              </div>
              <Input
                id="password" type="password" autoComplete="current-password"
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                required disabled={loading}
                className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>

            <Button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm shadow-sm shadow-blue-600/20 transition-all"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando sesión…</>
              ) : (
                <span className="flex items-center gap-1.5">Iniciar sesión <ChevronRight className="h-4 w-4" /></span>
              )}
            </Button>
          </form>

          {/* Separador */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs text-slate-400">¿Eres nuevo aquí?</span>
            </div>
          </div>

          <Button asChild variant="outline" className="w-full h-11 rounded-xl border-slate-200 font-medium text-sm text-slate-700 hover:bg-slate-50">
            <Link href="/signup">Crear una cuenta gratis</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
