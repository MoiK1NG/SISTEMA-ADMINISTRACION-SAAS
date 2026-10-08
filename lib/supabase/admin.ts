import { createClient } from "@supabase/supabase-js"

/**
 * Cliente de Supabase con la service role key: salta la RLS y puede crear o
 * modificar cuentas. SOLO para código de servidor (server actions y rutas);
 * la clave no tiene prefijo NEXT_PUBLIC_, así que nunca llega al navegador.
 */
export function crearClienteAdmin() {
  if (typeof window !== "undefined") {
    throw new Error("crearClienteAdmin() solo se puede usar en el servidor")
  }
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables del proyecto")
  }
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } })
}
