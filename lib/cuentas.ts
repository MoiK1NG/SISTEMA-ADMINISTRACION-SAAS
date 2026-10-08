import { crearClienteAdmin } from "@/lib/supabase/admin"

/**
 * Cuentas creadas por otra persona (el dueño para su equipo, o un admin).
 *
 * La cuenta queda confirmada y con una contraseña inicial que quien la crea le
 * pasa en persona. Lleva la marca app_metadata.debe_cambiar_clave: el
 * middleware manda a /cambiar-clave hasta que la persona elija la suya. Va en
 * app_metadata (y no en user_metadata) porque solo el servidor puede cambiarla.
 */

export const CLAVE_MIN = 8

export function validarClave(clave: unknown): string {
  if (typeof clave !== "string" || clave.length < CLAVE_MIN) {
    throw new Error(`La contraseña debe tener al menos ${CLAVE_MIN} caracteres`)
  }
  if (clave.length > 72) throw new Error("La contraseña es demasiado larga")
  return clave
}

export function validarCorreo(correo: unknown): string {
  const c = typeof correo === "string" ? correo.trim().toLowerCase() : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw new Error("El correo no es válido")
  return c
}

/** Crea la cuenta y devuelve su id. El perfil lo crea el trigger handle_new_user. */
export async function crearCuentaConClave({ email, nombre, clave }: {
  email: string; nombre: string; clave: string
}): Promise<string> {
  const { data, error } = await crearClienteAdmin().auth.admin.createUser({
    email,
    password:      clave,
    email_confirm: true,
    user_metadata: { full_name: nombre },
    app_metadata:  { debe_cambiar_clave: true },
  })

  if (error) {
    if ((error as any).code === "email_exists" || /already|registered|exists/i.test(error.message)) {
      throw new Error("Ya existe una cuenta con ese correo. Si es de esta persona, agrégala como cuenta existente.")
    }
    if (/password/i.test(error.message)) {
      throw new Error("La contraseña no cumple los requisitos de seguridad: usa una más larga o menos común.")
    }
    throw new Error(error.message)
  }
  return data.user.id
}

/** Deshace una cuenta recién creada si el paso siguiente falló. */
export async function borrarCuenta(userId: string) {
  await crearClienteAdmin().auth.admin.deleteUser(userId)
}

/** Quita la marca de "debe cambiar la contraseña". */
export async function marcarClaveCambiada(userId: string) {
  await crearClienteAdmin().auth.admin.updateUserById(userId, {
    app_metadata: { debe_cambiar_clave: false },
  })
}
