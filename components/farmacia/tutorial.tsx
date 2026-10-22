"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { pasosTutorial, TUTORIAL_VERSION } from "@/lib/farmacia/tutorial"
import type { RolFarmacia } from "@/lib/farmacia/contexto"
import { EVENTO_ABRIR_TUTORIAL } from "@/lib/tutorial-evento"

/**
 * Tutorial de primer ingreso por rol. Se abre solo la primera vez (lo decide
 * el layout con user_metadata) y después desde "Ver tutorial".
 *
 * `marcarVisto` es false en modo "ver como": el admin no debe marcar como
 * visto el tutorial de otra persona.
 */
export function TutorialFarmacia({ rol, autoAbrir, marcarVisto }: {
  rol:         RolFarmacia
  autoAbrir:   boolean
  marcarVisto: boolean
}) {
  const router = useRouter()
  const pasos = pasosTutorial(rol)
  const [abierto, setAbierto] = useState(autoAbrir)
  const [i, setI] = useState(0)
  const marcado = useRef(false)

  useEffect(() => {
    const abrir = () => { setI(0); setAbierto(true) }
    window.addEventListener(EVENTO_ABRIR_TUTORIAL, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_TUTORIAL, abrir)
  }, [])

  // Saltar, terminar o cerrar cuentan igual: no se vuelve a abrir solo
  function cerrar() {
    setAbierto(false)
    if (!marcarVisto || marcado.current) return
    marcado.current = true
    createClient()?.auth.updateUser({ data: { tutorial_farmacia: TUTORIAL_VERSION } })
      .then(({ error }) => { if (error) console.error("[tutorial]", error.message) })
  }

  const paso = pasos[i]
  const ultimo = i === pasos.length - 1
  const Icono = paso.icono

  return (
    <Dialog open={abierto} onOpenChange={v => { if (!v) cerrar() }}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-center justify-between pr-6">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Paso {i + 1} de {pasos.length}
          </span>
          {!ultimo && (
            <button onClick={cerrar} className="text-xs font-medium text-slate-400 hover:text-slate-700">
              Saltar tutorial
            </button>
          )}
        </div>

        <div className="flex flex-col items-center px-2 pt-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
            <Icono className="h-7 w-7 text-brand-600" />
          </div>
          <DialogTitle className="mt-4 text-lg font-bold text-slate-900">{paso.titulo}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-slate-600">
            {paso.texto}
          </DialogDescription>
          {paso.href && (
            <button
              onClick={() => { cerrar(); router.push(paso.href!) }}
              className="mt-3 text-xs font-semibold text-brand-700 hover:underline"
            >
              Ir ahora ›
            </button>
          )}
        </div>

        {/* Progreso */}
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {pasos.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-brand-600" : "w-1.5 bg-slate-200"}`} />
          ))}
        </div>

        <div className="mt-2 flex gap-3">
          <Button variant="outline" className="flex-1 gap-1.5" disabled={i === 0} onClick={() => setI(n => n - 1)}>
            <ArrowLeft className="h-3.5 w-3.5" />Anterior
          </Button>
          {ultimo ? (
            <Button className="flex-1 bg-brand-600 hover:bg-brand-700" onClick={cerrar}>Empezar</Button>
          ) : (
            <Button className="flex-1 gap-1.5 bg-brand-600 hover:bg-brand-700" onClick={() => setI(n => n + 1)}>
              Siguiente<ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
