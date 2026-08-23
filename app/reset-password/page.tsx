"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { LockKeyhole, Loader2, AlertTriangle, CheckCircle2, LinkIcon } from "lucide-react"

type Estado = "verificando" | "listo" | "sin_sesion" | "exito"

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [estado,   setEstado]   = useState<Estado>("verificando")
  const [password, setPassword] = useState("")
  const [confirma, setConfirma] = useState("")
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  // El enlace del correo ya pasó por /auth/callback, que dejó la sesión de
  // recuperación en la cookie. Sin sesión, el enlace es inválido o venció.
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setEstado(data.session ? "listo" : "sin_sesion")
    })
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (password !== confirma) { setError("Las contraseñas no coinciden."); return }
    if (password.length < 6)   { setError("La contraseña debe tener al menos 6 caracteres."); return }

    setLoading(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(
        error.message.toLowerCase().includes("should be different")
          ? "La contraseña nueva debe ser distinta a la anterior."
          : "No se pudo actualizar la contraseña. Solicita un enlace nuevo."
      )
      setLoading(false)
      return
    }

    setEstado("exito")
    setLoading(false)
    setTimeout(() => { router.push("/dashboard"); router.refresh() }, 2000)
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

  /* ── Verificando el enlace ───────────────────────────────────────────── */
  if (estado === "verificando") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Verificando el enlace…</p>
        </div>
      </div>
    )
  }

  /* ── Enlace inválido o vencido ───────────────────────────────────────── */
  if (estado === "sin_sesion") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-10 max-w-sm w-full text-center space-y-5 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 mx-auto">
            <LinkIcon className="h-7 w-7 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Enlace no válido</h2>
            <p className="mt-2 text-sm text-slate-500">
              Este enlace ya venció o se usó antes. Solicita uno nuevo para continuar.
            </p>
          </div>
          <Button asChild className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700">
            <Link href="/forgot-password">Solicitar enlace nuevo</Link>
          </Button>
          <Link href="/login" className="block text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  /* ── Contraseña actualizada ──────────────────────────────────────────── */
  if (estado === "exito") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-emerald-200 bg-white p-10 max-w-sm w-full text-center space-y-4 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Contraseña actualizada</h2>
            <p className="mt-2 text-sm text-slate-500">Entrando a tu cuenta…</p>
          </div>
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
            <LockKeyhole className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Crea una contraseña nueva</h1>
          <p className="mt-1.5 text-sm text-slate-500">Mínimo 6 caracteres.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700">
              Contraseña nueva
            </Label>
            <Input
              id="password" type="password" autoComplete="new-password" autoFocus
              placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              required minLength={6} disabled={loading}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirma" className="text-sm font-medium text-slate-700">
              Confirmar contraseña
            </Label>
            <Input
              id="confirma" type="password" autoComplete="new-password"
              placeholder="••••••••"
              value={confirma} onChange={e => setConfirma(e.target.value)}
              required minLength={6} disabled={loading}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>

          <Button
            type="submit" disabled={loading}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm shadow-sm shadow-blue-600/20"
          >
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</>
              : "Guardar contraseña"}
          </Button>
        </form>
      </div>
    </div>
  )
}
