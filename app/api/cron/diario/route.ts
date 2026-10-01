import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Siempre en el momento: nada de caché para una tarea programada
export const dynamic = "force-dynamic"

/**
 * Mantenimiento diario, disparado por la tarea programada de Vercel
 * (vercel.json → "crons"). Mantiene despierto el proyecto de Supabase (el plan
 * gratuito lo pausa tras 1 semana sin actividad) y ejecuta
 * ejecutar_mantenimiento_diario(): membresías vencidas, alertas de farmacia y
 * registro de la ejecución. Ver supabase/mantenimiento_diario.sql.
 *
 * Vercel manda "Authorization: Bearer <CRON_SECRET>" cuando esa variable
 * existe en el proyecto; sin ella o con otra clave, la ruta no hace nada.
 * Corre sin usuario logueado, por eso usa la service role key (solo servidor).
 */
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET
  if (!secreto) {
    return NextResponse.json({ ok: false, error: "Falta CRON_SECRET en las variables del proyecto" }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables del proyecto" }, { status: 500 })
  }

  const supabase = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.rpc("ejecutar_mantenimiento_diario")
  if (error) {
    console.error("[cron diario]", error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) })
}
