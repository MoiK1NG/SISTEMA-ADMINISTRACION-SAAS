import { createClient } from "./server"
import { redirect } from "next/navigation"

/**
 * Retorna el cliente de Supabase garantizando que no es null.
 * Si las env vars no están configuradas, redirige a /login.
 * Usar en Server Components y Server Actions.
 */
export async function requireClient() {
  const supabase = await createClient()
  if (!supabase) redirect("/login")
  return supabase
}
