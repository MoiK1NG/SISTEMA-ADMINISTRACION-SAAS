import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  // `next` viene de la URL: solo se aceptan rutas internas.
  // "//host" es una URL protocol-relative y saldría del sitio.
  const nextParam = searchParams.get("next") ?? "/"
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"

  if (code) {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.redirect(`${origin}/auth/error`)
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host")
      const isLocalEnv = process.env.NODE_ENV === "development"

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Enlace inválido, vencido o ya usado
  return NextResponse.redirect(`${origin}/auth/error`)
}
