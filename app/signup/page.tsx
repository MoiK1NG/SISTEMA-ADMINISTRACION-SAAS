"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Building2, Loader2, AlertTriangle, CheckCircle2, ChevronRight,
  Sparkles, Users, Globe,
} from "lucide-react"

const PERKS = [
  { icon: Sparkles, text: "Acceso a múltiples portales de negocio" },
  { icon: Users,    text: "Gestión de clientes y cartera integrada" },
  { icon: Globe,    text: "Disponible desde cualquier dispositivo"   },
]

export default function SignupPage() {
  const [fullName, setFullName] = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) { setError("Supabase no configurado."); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${window.location.origin}/auth/callback`,
        data: { full_name: fullName },
      },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
  }

  /* ── Estado de éxito ────────────────────────────────────────────────── */
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-emerald-200 bg-white p-10 max-w-sm w-full text-center space-y-5 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Revisa tu correo</h2>
            <p className="mt-2 text-sm text-slate-500">
              Enviamos un enlace de confirmación a <span className="font-medium text-slate-700">{email}</span>.
              Activa tu cuenta y luego inicia sesión.
            </p>
          </div>
          <Button asChild className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700">
            <Link href="/login">Ir a iniciar sesión</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Panel izquierdo ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden bg-slate-50 border-r border-slate-100 p-12">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-sky-100/50 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-sm shadow-blue-600/25">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">SaaS Admin</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">Sistema Empresarial</p>
          </div>
        </div>

        {/* Contenido central */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
              <Sparkles className="h-3 w-3" />
              Empieza gratis hoy
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900">
              Tu negocio en orden,<br />
              <span className="text-blue-600">desde el primer día</span>
            </h1>
            <p className="text-base text-slate-500 leading-relaxed max-w-sm">
              Crea tu cuenta y accede a herramientas diseñadas para pequeños emprendedores.
            </p>
          </div>

          <ul className="space-y-3">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm">
                  <Icon className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-sm text-slate-600">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} SaaS Admin · Todos los derechos reservados
        </p>
      </div>

      {/* ── Panel derecho — formulario ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 sm:px-12">
        {/* Logo móvil */}
        <div className="lg:hidden mb-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">SaaS Admin</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Crear una cuenta</h2>
            <p className="mt-1.5 text-sm text-slate-500">Regístrate gratis y empieza en minutos</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">Nombre completo</Label>
              <Input
                id="fullName" type="text" autoComplete="name"
                placeholder="Juan Pérez"
                value={fullName} onChange={e => setFullName(e.target.value)}
                required disabled={loading}
                className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Correo electrónico</Label>
              <Input
                id="email" type="email" autoComplete="email"
                placeholder="tu@correo.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required disabled={loading}
                className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña</Label>
              <Input
                id="password" type="password" autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={password} onChange={e => setPassword(e.target.value)}
                required minLength={6} disabled={loading}
                className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>

            <Button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm shadow-sm shadow-blue-600/20"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando cuenta…</>
              ) : (
                <span className="flex items-center gap-1.5">Crear cuenta gratis <ChevronRight className="h-4 w-4" /></span>
              )}
            </Button>

            <p className="text-xs text-slate-400 text-center">
              Al registrarte aceptas nuestros términos de uso y política de privacidad.
            </p>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs text-slate-400">¿Ya tienes cuenta?</span>
            </div>
          </div>

          <Button asChild variant="outline" className="w-full h-11 rounded-xl border-slate-200 font-medium text-sm text-slate-700 hover:bg-slate-50">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
