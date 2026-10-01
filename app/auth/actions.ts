"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { COOKIE_VER_COMO } from "@/lib/ver-como"

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
