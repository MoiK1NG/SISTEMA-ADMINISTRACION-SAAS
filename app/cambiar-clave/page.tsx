import { redirect } from "next/navigation"
import { sesionActual } from "@/lib/admin-context"
import { FormCambiarClave } from "./form-cambiar-clave"

export const metadata = { title: "Cambiar contraseña" }

/**
 * Cambio de contraseña. Es obligatorio en el primer ingreso de una cuenta
 * creada por el dueño o un admin (el middleware redirige acá mientras
 * app_metadata.debe_cambiar_clave sea true) y opcional para el resto.
 */
export default async function CambiarClavePage() {
  const { user } = await sesionActual()
  if (!user) redirect("/login")

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4 py-12">
      <FormCambiarClave
        email={user.email ?? ""}
        obligatorio={user.app_metadata?.debe_cambiar_clave === true}
      />
    </div>
  )
}
