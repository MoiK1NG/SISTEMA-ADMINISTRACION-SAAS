"use server"

import { cookies } from "next/headers"
import { createClient as crearClienteSupabase } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { COOKIE_VER_COMO } from "@/lib/ver-como"
import { marcarClaveCambiada, validarClave } from "@/lib/cuentas"

/**
 * Cambia la contraseña de quien está logueado. Pide la actual y la verifica
 * con un cliente aparte (sin tocar la sesión en curso), porque Supabase no la
 * exige para cambiarla. Si la cuenta venía con contraseña inicial, quita la
 * marca y deja de redirigir a /cambiar-clave.
 */
export async function cambiarClave(actual: string, nueva: string) {
  const supabase = await createClient()
  if (!supabase) throw new Error("No se pudo conectar")
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) throw new Error("No hay una sesión activa")

  validarClave(nueva)
  if (nueva === actual) throw new Error("La nueva contraseña tiene que ser distinta de la actual")

  const verificador = crearClienteSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error: errActual } = await verificador.auth.signInWithPassword({ email: user.email, password: actual })
  if (errActual) throw new Error("La contraseña actual no es correcta")

  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (error) {
    if (/weak|pwned|password/i.test(error.message)) {
      throw new Error("La nueva contraseña no cumple los requisitos de seguridad: usa una más larga o menos común.")
    }
    throw new Error(error.message)
  }

  if (user.app_metadata?.debe_cambiar_clave) await marcarClaveCambiada(user.id)
  return { success: true }
}

/**
 * Tras restablecer la contraseña con el enlace del correo: si la cuenta tenía
 * contraseña inicial pendiente de cambio, ya no hace falta pedirla de nuevo.
 */
export async function confirmarClaveRestablecida() {
  const supabase = await createClient()
  if (!supabase) return { success: false }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.app_metadata?.debe_cambiar_clave) return { success: true }

  // Solo si hubo de verdad un pedido de restablecimiento en las últimas 24 h:
  // si no, llamar a esta acción alcanzaría para saltarse el cambio obligatorio.
  const pedido = user.recovery_sent_at ? new Date(user.recovery_sent_at).getTime() : 0
  if (Date.now() - pedido < 24 * 3_600_000) await marcarClaveCambiada(user.id)
  return { success: true }
}

/**
 * Cierra la sesión en el servidor y borra el modo "ver como cliente".
 *
 * La cookie de "ver como" es httpOnly y dura 4 horas: si solo se cerraba la
 * sesión desde el navegador, quedaba viva y la siguiente persona que entrara
 * en ese equipo (por ejemplo un cajero después del admin) heredaba el modo de
 * solo lectura. Todos los botones de "Cerrar sesión" pasan por acá.
 */
export async function cerrarSesion() {
  ;(await cookies()).delete(COOKIE_VER_COMO)
  const supabase = await createClient()
  if (supabase) await supabase.auth.signOut()
  return { success: true }
}
