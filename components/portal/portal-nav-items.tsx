"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Shield, ArrowLeftRight } from "lucide-react"
import { BotonCerrarSesion } from "@/components/boton-cerrar-sesion"
import { PORTALES } from "./portal-config"

export interface OtroPortal {
  slug:  string
  nombre: string
  color: string
}

interface Props {
  portal:  string
  top:     14 | 16
  sticky:  boolean
  esAdmin: boolean
  otros:   OtroPortal[]
}

const ACCION = "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors"

export function PortalNavItems({ portal, top, sticky, esAdmin, otros }: Props) {
  const pathname = usePathname()
  const config = PORTALES[portal]
  if (!config) return null

  const { secciones } = config
  const raiz = secciones[0].href

  return (
    <nav
      className={`z-20 shrink-0 border-b border-slate-100 bg-white/85 backdrop-blur-md ${
        sticky ? (top === 14 ? "sticky top-14" : "sticky top-16") : ""
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">

        {/* ── Secciones (con scroll si no entran) ─────────────────────────── */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {secciones.map(({ href, label, icon: Icon }) => {
            // La raíz solo con coincidencia exacta; el resto acepta rutas hijas.
            const activo = href === raiz ? pathname === href : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activo ? "text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                style={activo ? { backgroundColor: config.color } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            )
          })}

          {/* ── Saltar a otro negocio ─────────────────────────────────────── */}
          {otros.length > 0 && (
            <>
              <div className="mx-1.5 h-5 w-px shrink-0 bg-slate-200" />
              <span className="hidden shrink-0 items-center gap-1 pr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:flex">
                <ArrowLeftRight className="h-3 w-3" />
                Ir a
              </span>
              {otros.map(p => (
                <Link
                  key={p.slug}
                  href={`/portal/${p.slug}`}
                  title={`Ir a ${p.nombre}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.nombre}
                </Link>
              ))}
            </>
          )}
        </div>

        {/* ── Volver y salir: fijos, siempre visibles aunque haya scroll ──── */}
        <div className="flex shrink-0 items-center gap-1 border-l border-slate-200 py-2 pl-2">
          {esAdmin && (
            <Link
              href="/admin"
              title="Volver al panel de administración"
              className={`${ACCION} border border-brand-200 bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Panel admin</span>
            </Link>
          )}
          <Link
            href="/dashboard"
            title="Volver a mis portales"
            className={`${ACCION} text-slate-600 hover:bg-slate-100 hover:text-slate-900`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Mis portales</span>
          </Link>
          <BotonCerrarSesion
            className={`${ACCION} text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60 [&>span]:hidden lg:[&>span]:inline`}
          />
        </div>
      </div>
    </nav>
  )
}
