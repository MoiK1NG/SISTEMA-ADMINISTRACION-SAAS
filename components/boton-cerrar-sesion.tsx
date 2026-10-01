"use client"

import { useTransition } from "react"
import { Loader2, LogOut } from "lucide-react"
import { cerrarSesion } from "@/app/auth/actions"

/**
 * "Cerrar sesión" para cualquier pantalla. Cierra en el servidor (y borra el
 * modo "ver como") y recarga el login completo, para que la siguiente cuenta
 * que entre en el equipo no herede nada en memoria.
 */
export function BotonCerrarSesion({ className = "", conTexto = true }: { className?: string; conTexto?: boolean }) {
  const [saliendo, start] = useTransition()

  return (
    <button
      type="button"
      title="Cerrar sesión"
      disabled={saliendo}
      onClick={() => start(async () => {
        await cerrarSesion()
        window.location.assign("/login")
      })}
      className={className}
    >
      {saliendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      {conTexto && <span>{saliendo ? "Saliendo…" : "Cerrar sesión"}</span>}
    </button>
  )
}

/** Para menús y botones propios: misma lógica, sin UI. */
export async function salirDeLaCuenta() {
  await cerrarSesion()
  window.location.assign("/login")
}
