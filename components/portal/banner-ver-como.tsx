"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, LogOut, Loader2 } from "lucide-react"
import { salirDeVerComo } from "@/app/admin/ver-como-actions"

interface Props {
  nombre: string
  email:  string
}

/**
 * Aviso permanente de que el admin está mirando los datos de un cliente.
 * Deja claro de quién son los datos y que no se puede escribir.
 */
export function BannerVerComo({ nombre, email }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()

  function salir() {
    start(async () => {
      await salirDeVerComo()
      router.push("/admin/users")
      router.refresh()
    })
  }

  return (
    <div className="border-b border-amber-300 bg-amber-100/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6 lg:px-8">
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
          <Eye className="h-3 w-3" />
          Modo lectura
        </span>

        <p className="min-w-0 flex-1 text-sm text-amber-900">
          Estás viendo los datos de{" "}
          <strong className="font-bold">{nombre}</strong>
          <span className="hidden text-amber-700 sm:inline"> · {email}</span>
          <span className="block text-xs text-amber-700 sm:inline sm:before:content-['_—_']">
            no podés crear ni modificar nada mientras esté activo
          </span>
        </p>

        <button
          onClick={salir}
          disabled={isPending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-bold text-amber-50 transition-colors hover:bg-amber-800 disabled:opacity-60"
        >
          {isPending
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saliendo…</>
            : <><LogOut className="h-3.5 w-3.5" />Volver a mi cuenta</>}
        </button>
      </div>
    </div>
  )
}
