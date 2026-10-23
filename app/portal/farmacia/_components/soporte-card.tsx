"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Headset, Loader2, LockKeyhole, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFormato } from "@/components/farmacia/negocio-provider"
import { autorizarSoporte, revocarSoporte } from "../actions"

/**
 * El dueño decide si el equipo de LOMS 360 puede ver sus datos sensibles
 * (ventas, clientes, recetas, caja y finanzas) para darle soporte. Sin su
 * permiso solo se ve lo técnico: inventario, equipo y configuración.
 * Activar y revocar queda en la auditoría.
 */
export function SoporteCard({ hasta }: { hasta: string | null }) {
  const f = useFormato()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()
  const activo = Boolean(hasta) && new Date(hasta!).getTime() > Date.now()

  function correr(fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      try { await fn(); router.refresh() }
      catch (e: any) { setError(e?.message ?? "No se pudo completar") }
    })
  }

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${activo ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-white"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activo ? "bg-amber-100" : "bg-slate-100"}`}>
            {activo ? <Headset className="h-4 w-4 text-amber-700" /> : <LockKeyhole className="h-4 w-4 text-slate-500" />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Soporte de LOMS 360</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {activo
                ? <>El equipo de soporte puede <strong>ver</strong> tus ventas, clientes, recetas, caja y finanzas hasta el {f.fechaHora(hasta!)}. No puede modificar nada.</>
                : "Tus ventas, clientes, recetas, caja y finanzas son privados. Si necesitas ayuda con ellos, da permiso por 24 horas; lo puedes quitar cuando quieras."}
            </p>
            {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
          </div>
        </div>
        {activo ? (
          <Button variant="outline" size="sm" disabled={isPending} className="shrink-0"
                  onClick={() => correr(revocarSoporte)}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Quitar permiso"}
          </Button>
        ) : (
          <Button size="sm" disabled={isPending} className="shrink-0 gap-1.5 bg-brand-600 hover:bg-brand-700"
                  onClick={() => correr(() => autorizarSoporte(24))}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><ShieldCheck className="h-3.5 w-3.5" />Permitir por 24 h</>}
          </Button>
        )}
      </div>
    </section>
  )
}
