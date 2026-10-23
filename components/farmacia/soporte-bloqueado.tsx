import { LockKeyhole } from "lucide-react"
import { PortalNav } from "@/components/portal/portal-nav"
import { BannerVerComo } from "@/components/portal/banner-ver-como"
import type { ClienteVisto } from "@/lib/admin-context"

/**
 * Lo que ve un admin en "ver como" en una sección con datos sensibles
 * (ventas, clientes, recetas, caja, finanzas) cuando el dueño no autorizó el
 * acceso de soporte. La RLS ya devuelve cero filas; esto evita que parezca
 * un negocio vacío.
 */
export function PaginaSoporteBloqueado({ seccion, viendoA }: { seccion: string; viendoA: ClienteVisto | null }) {
  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <PortalNav portal="farmacia" />
      {viendoA && <BannerVerComo nombre={viendoA.full_name || viendoA.email} email={viendoA.email} />}
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <LockKeyhole className="h-6 w-6 text-slate-400" />
        </div>
        <p className="mt-4 text-sm font-bold text-slate-900">{seccion}: sin permiso de soporte</p>
        <p className="mt-1 text-sm text-slate-500">
          El dueño no autorizó el acceso de soporte de LOMS 360, así que sus ventas, clientes, recetas y
          finanzas no se muestran. Puede darlo por 24 horas desde el inicio de su portal.
          El inventario y el equipo sí se ven.
        </p>
      </div>
    </div>
  )
}
