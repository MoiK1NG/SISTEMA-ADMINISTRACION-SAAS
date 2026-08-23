"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { KeyRound, Loader2, AlertTriangle, MailCheck, ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("")
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) { setError("Supabase no configurado."); return }
    setLoading(true); setError(null)

    // El enlace del correo pasa por /auth/callback, que canjea el código por
    // sesión y reenvía a /reset-password para definir la contraseña nueva.
    const base = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
      ?? `${window.location.origin}/auth/callback`
    const redirectTo = `${base}${base.includes("?") ? "&" : "?"}next=/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    // No se distingue si el correo existe o no: evita filtrar qué cuentas hay.
    if (error && !error.message.toLowerCase().includes("not found")) {
      setError("No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.")
      setLoading(false)
      return
    }

    setEnviado(true)
    setLoading(false)
  }

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 max-w-sm w-full text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <p className="font-semibold text-slate-800">Configuración requerida</p>
          <p className="text-sm text-slate-500">
            Agrega <code className="bg-white rounded px-1">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code className="bg-white rounded px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          </p>
        </div>
      </div>
    )
  }

  /* ── Correo enviado ──────────────────────────────────────────────────── */
  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-10 max-w-sm w-full text-center space-y-5 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 mx-auto">
            <MailCheck className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Revisa tu correo</h2>
            <p className="mt-2 text-sm text-slate-500">
              Si <span className="font-medium text-slate-700">{email}</span> tiene una cuenta,
              te enviamos un enlace para crear una contraseña nueva. El enlace vence en una hora.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full h-11 rounded-xl border-slate-200 font-medium text-sm text-slate-700 hover:bg-slate-50">
            <Link href="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>
      </div>
    )
  }

  /* ── Formulario ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-8 sm:p-10 max-w-sm w-full space-y-6 shadow-sm">

        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 mx-auto mb-4">
            <KeyRound className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">¿Olvidaste tu contraseña?</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Escribe tu correo y te enviamos un enlace para crear una nueva.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
              id="email" type="email" autoComplete="email" autoFocus
              placeholder="tu@correo.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required disabled={loading}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>

          <Button
            type="submit" disabled={loading}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm shadow-sm shadow-blue-600/20"
          >
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando…</>
              : "Enviar enlace de recuperación"}
          </Button>
        </form>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}
