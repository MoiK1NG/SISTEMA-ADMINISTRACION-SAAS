"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { KeyRound, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BotonCerrarSesion } from "@/components/boton-cerrar-sesion"
import { cambiarClave } from "@/app/auth/actions"

const CLAVE_MIN = 8

export function FormCambiarClave({ email, obligatorio }: { email: string; obligatorio: boolean }) {
  const [actual, setActual]       = useState("")
  const [nueva, setNueva]         = useState("")
  const [repetida, setRepetida]   = useState("")
  const [error, setError]         = useState<string | null>(null)
  const [listo, setListo]         = useState(false)
  const [guardando, start]        = useTransition()

  const problema =
    nueva && nueva.length < CLAVE_MIN ? `Mínimo ${CLAVE_MIN} caracteres`
    : repetida && nueva !== repetida  ? "Las contraseñas no coinciden"
    : null

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      try {
        await cambiarClave(actual, nueva)
        setListo(true)
      } catch (err: any) {
        setError(err?.message ?? "No se pudo cambiar la contraseña")
      }
    })
  }

  if (listo) {
    return (
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <div>
          <p className="text-lg font-bold text-brand-900">Contraseña actualizada</p>
          <p className="mt-1 text-sm text-slate-500">Desde ahora entras con tu nueva contraseña.</p>
        </div>
        {/* Navegación completa: el middleware vuelve a leer la cuenta ya sin la marca */}
        <Button className="h-11 w-full rounded-xl bg-brand-600 hover:bg-brand-700" onClick={() => window.location.assign("/dashboard")}>
          Continuar
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="space-y-4">
        <img src="/brand/loms360-logo.svg" alt="LOMS 360" className="h-8 w-auto" />
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-brand-900">
            <KeyRound className="h-5 w-5 text-brand-600" />
            {obligatorio ? "Elige tu contraseña" : "Cambiar contraseña"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {obligatorio
              ? "Tu cuenta se creó con una contraseña inicial. Antes de seguir, elige una que solo conozcas tú."
              : <>Cuenta <span className="font-medium text-slate-700">{email}</span></>}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="actual">{obligatorio ? "Contraseña inicial" : "Contraseña actual"}</Label>
          <Input id="actual" type="password" autoComplete="current-password" required autoFocus
                 value={actual} onChange={e => setActual(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nueva">Nueva contraseña</Label>
          <Input id="nueva" type="password" autoComplete="new-password" required minLength={CLAVE_MIN}
                 placeholder={`Mínimo ${CLAVE_MIN} caracteres`}
                 value={nueva} onChange={e => setNueva(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="repetida">Repite la nueva contraseña</Label>
          <Input id="repetida" type="password" autoComplete="new-password" required
                 value={repetida} onChange={e => setRepetida(e.target.value)} className="h-11 rounded-xl" />
        </div>
        {problema && <p className="text-xs font-medium text-amber-700">{problema}</p>}
      </div>

      <div className="space-y-3">
        <Button type="submit" className="h-11 w-full rounded-xl bg-brand-600 font-semibold hover:bg-brand-700"
                disabled={guardando || !actual || !nueva || nueva !== repetida || nueva.length < CLAVE_MIN}>
          {guardando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</> : "Guardar contraseña"}
        </Button>
        <div className="flex items-center justify-between text-xs">
          {obligatorio
            ? <span className="text-slate-400">Es un paso único.</span>
            : <Link href="/dashboard" className="font-medium text-slate-500 hover:text-slate-800">Volver</Link>}
          <BotonCerrarSesion className="flex items-center gap-1.5 font-medium text-slate-500 hover:text-rose-700" />
        </div>
      </div>
    </form>
  )
}
